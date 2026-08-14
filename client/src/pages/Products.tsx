import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, useCreateTransaction } from "@/hooks/use-transactions";
import { useProducts } from "@/hooks/use-products";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogScrollArea } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Package, Pencil, Trash2, PackageOpen, ShoppingBag, Clock, ArrowDownCircle, AlertTriangle, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CurrencyInput, parseBRL, centsToFormatted } from "@/components/CurrencyInput";
import { STORE_OPTIONS, getStoreLabel } from "@shared/schema";
import type { Product } from "@shared/schema";

const UNIT_OPTIONS = [
  { value: "UN", label: "UN (Unidade)" },
  { value: "KG", label: "KG (Quilograma)" },
  { value: "M", label: "M (Metro)" },
  { value: "M2", label: "M\u00B2 (Metro Quadrado)" },
  { value: "M3", label: "M\u00B3 (Metro C\u00FAbico)" },
  { value: "CX", label: "CX (Caixa)" },
  { value: "FD", label: "FD (Fardo)" },
  { value: "LT", label: "LT (Litro)" },
];

function formatUnit(unit: string): string {
  if (unit === "M2") return "M\u00B2";
  if (unit === "M3") return "M\u00B3";
  return unit;
}

export default function Products() {
  const { canManage, isOperador, user, isMaster, userStore } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading, isError, refetch } = useProducts();

  const [showCreate, setShowCreate] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [pendingExpense, setPendingExpense] = useState<{ name: string; unit: string; quantity: number; priceCents: number } | null>(null);

  const [formName, setFormName] = useState("");
  const [formSpecification, setFormSpecification] = useState("");
  const [formUnit, setFormUnit] = useState("UN");
  const [formStore, setFormStore] = useState("none");
  const [formQuantity, setFormQuantity] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formDate, setFormDate] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; specification?: string; unit: string; store?: string; quantity: number; price: number; createdAt?: string }) => {
      if (!user) throw new Error("Nao autenticado.");
      const storeVal = !isMaster && userStore ? userStore : (data.store || null);
      const ref = doc(collection(db, "products"));
      await setDoc(ref, {
        name: data.name,
        specification: data.specification ?? null,
        unit: data.unit,
        store: storeVal,
        quantity: data.quantity,
        price: data.price,
        userId: user.id,
        active: 1,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      });
      return { input: data };
    },
    onSuccess: ({ input }) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Produto cadastrado", description: "O produto foi adicionado com sucesso." });
      const totalCents = input.quantity * input.price;
      if (totalCents > 0 && input.quantity > 0) {
        setPendingExpense({ name: input.name, unit: input.unit, quantity: input.quantity, priceCents: input.price });
        setShowExpenseDialog(true);
      }
      resetForm();
      setShowCreate(false);
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message || "Erro ao criar produto", variant: "destructive" });
    },
  });

  const createExpenseMutation = useCreateTransaction();

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<{ name: string; specification: string; unit: string; store: string | null; quantity: number; price: number }> }) => {
      await updateDoc(doc(db, "products", id), data as Record<string, any>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Produto atualizado", description: "As alteracoes foram salvas." });
      setEditProduct(null);
    },
    onError: (err: Error) => {
      const msg = (err as any)?.code === "permission-denied" ? "Apenas administradores podem editar produtos." : err.message;
      toast({ title: "Erro", description: msg || "Erro ao atualizar produto", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await updateDoc(doc(db, "products", id), { active: 0 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Produto removido", description: "O produto foi desativado." });
    },
    onError: (err: Error) => {
      const msg = (err as any)?.code === "permission-denied" ? "Apenas administradores podem remover produtos." : err.message;
      toast({ title: "Erro", description: msg || "Erro ao remover produto", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormSpecification("");
    setFormUnit("UN");
    setFormStore("none");
    setFormQuantity("");
    setFormPrice("");
    setFormDate("");
  };

  const getNowDatetimeLocal = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  };

  const openCreate = () => {
    resetForm();
    setFormDate(getNowDatetimeLocal());
    setShowCreate(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setFormName(p.name);
    setFormSpecification(p.specification || "");
    setFormUnit(p.unit || "UN");
    setFormStore(p.store || "none");
    setFormQuantity(String(p.quantity));
    setFormPrice(centsToFormatted(p.price));
  };

  const submitCreate = () => {
    const price = Math.round(parseBRL(formPrice) * 100);
    const quantity = parseInt(formQuantity) || 0;
    if (!formName.trim() || isNaN(price) || price <= 0) return;
    const data: { name: string; specification?: string; unit: string; store?: string; quantity: number; price: number; createdAt?: string } = { name: formName.trim(), unit: formUnit, quantity, price };
    if (formSpecification.trim()) {
      data.specification = formSpecification.trim();
    }
    if (formStore && formStore !== "none") {
      data.store = formStore;
    }
    if (formDate) {
      data.createdAt = new Date(formDate).toISOString();
    }
    createMutation.mutate(data);
  };

  const submitEdit = () => {
    if (!editProduct) return;
    const price = Math.round(parseBRL(formPrice) * 100);
    const quantity = parseInt(formQuantity) || 0;
    if (!formName.trim() || isNaN(price) || price <= 0) return;
    const storeVal = formStore && formStore !== "none" ? formStore : null;
    updateMutation.mutate({ id: editProduct.id, data: { name: formName.trim(), specification: formSpecification.trim() || undefined, unit: formUnit, store: storeVal, quantity, price } });
  };

  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + (Number.isFinite(p.quantity) ? p.quantity : 0), 0);
  const totalValue = products.reduce((sum, p) => {
    const qty = Number.isFinite(p.quantity) ? p.quantity : 0;
    const price = Number.isFinite(p.price) ? p.price : 0;
    return sum + qty * price;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-products-title">Gestao de Produtos</h2>
          <p className="text-muted-foreground mt-1">Cadastre e gerencie seu estoque de produtos.</p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="rounded-xl px-6" data-testid="button-add-product">
            <Plus className="mr-2 h-5 w-5" /> Novo Produto
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10">
              <Package className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Produtos Cadastrados</p>
              <p className="text-2xl font-bold" data-testid="text-product-count">{totalProducts}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <ShoppingBag className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total em Estoque</p>
              <p className="text-2xl font-bold" data-testid="text-total-stock">{totalStock} itens</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10">
              <PackageOpen className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor Total do Estoque</p>
              <p className="text-2xl font-bold" data-testid="text-total-value">{formatCurrency(totalValue / 100)}</p>
            </div>
          </div>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-4 p-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 w-full bg-muted/50 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Nao foi possivel carregar os produtos</h3>
          <p className="max-w-xs mx-auto mt-2">Verifique sua conexao e tente novamente.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()} data-testid="button-retry-products">
            <RotateCcw className="h-4 w-4 mr-2" /> Tentar novamente
          </Button>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Package className="w-8 h-8 opacity-50" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Nenhum produto cadastrado</h3>
          <p className="max-w-xs mx-auto mt-2">Adicione produtos para gerenciar seu estoque.</p>
        </div>
      ) : (
        <>
        <div className="hidden sm:block rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="pl-6">Nome</TableHead>
                <TableHead>Especificacao</TableHead>
                <TableHead>Data de Entrada</TableHead>
                <TableHead className="text-right">Qtd. Estoque</TableHead>
                <TableHead className="text-right">Preco Sugerido</TableHead>
                {canManage && <TableHead className="text-right pr-6">Acoes</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/30 border-border/50 transition-colors" data-testid={`row-product-${p.id}`}>
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-medium" data-testid={`text-product-name-${p.id}`}>{p.name}</span>
                        {p.store && (
                          <span className="ml-2 text-xs text-muted-foreground" data-testid={`text-product-store-${p.id}`}>
                            {getStoreLabel(p.store)}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm" data-testid={`text-product-spec-${p.id}`}>
                    {p.specification || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <div className="flex items-center gap-1.5" data-testid={`text-product-date-${p.id}`}>
                      <Clock className="w-3.5 h-3.5" />
                      {format(new Date(p.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="secondary"
                      className={p.quantity <= 0 ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400" : ""}
                      data-testid={`text-product-qty-${p.id}`}
                    >
                      {Number.isFinite(p.quantity) ? p.quantity : 0} {formatUnit(p.unit || "UN")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium" data-testid={`text-product-price-${p.id}`}>
                    {formatCurrency(p.price / 100)}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)} data-testid={`button-edit-product-${p.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-delete-product-${p.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover produto?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O produto <span className="font-semibold">{p.name}</span> sera desativado e removido da lista.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(p.id)}
                                className="bg-destructive"
                                data-testid={`button-confirm-delete-product-${p.id}`}
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="sm:hidden space-y-3">
          {products.map((p) => (
            <Card key={p.id} className="p-4" data-testid={`card-product-${p.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate" data-testid={`text-product-name-${p.id}`}>
                      {p.name}
                      {p.store && (
                        <span className="ml-1 text-xs text-muted-foreground font-normal">
                          ({getStoreLabel(p.store)})
                        </span>
                      )}
                    </p>
                    {p.specification && (
                      <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-product-spec-${p.id}`}>{p.specification}</p>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5" data-testid={`text-product-date-${p.id}`}>
                      <Clock className="w-3 h-3" />
                      {format(new Date(p.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)} data-testid={`button-edit-product-${p.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-delete-product-${p.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover produto?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O produto <span className="font-semibold">{p.name}</span> sera desativado e removido da lista.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(p.id)} className="bg-destructive">Remover</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border/50">
                <Badge
                  variant="secondary"
                  className={p.quantity <= 0 ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400" : ""}
                  data-testid={`text-product-qty-${p.id}`}
                >
                  {Number.isFinite(p.quantity) ? p.quantity : 0} {formatUnit(p.unit || "UN")}
                </Badge>
                <span className="font-mono font-medium" data-testid={`text-product-price-${p.id}`}>
                  {formatCurrency(p.price / 100)}
                </span>
              </div>
            </Card>
          ))}
        </div>
        </>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Produto</DialogTitle>
            <DialogDescription>Cadastre um novo produto no estoque.</DialogDescription>
          </DialogHeader>
          <DialogScrollArea>
            <div className="space-y-3 pb-4">
              <div className="space-y-1">
                <Label htmlFor="create-product-name">Nome</Label>
                <Input id="create-product-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Parafuso, Cimento, Cabo" data-testid="input-product-name" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="create-product-spec">Especificacao / Tamanho</Label>
                <Input id="create-product-spec" value={formSpecification} onChange={(e) => setFormSpecification(e.target.value)} placeholder="Ex: 1cm, 80cm, 50kg, Azul" data-testid="input-product-specification" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Unidade</Label>
                  <Select value={formUnit} onValueChange={setFormUnit} data-testid="select-product-unit">
                    <SelectTrigger data-testid="select-product-unit-trigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} data-testid={`select-unit-${opt.value}`}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="create-product-qty">Quantidade</Label>
                  <Input id="create-product-qty" type="number" min="0" value={formQuantity} onChange={(e) => setFormQuantity(e.target.value)} placeholder="0" data-testid="input-product-quantity" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Loja / Origem</Label>
                <Select value={formStore} onValueChange={setFormStore}>
                  <SelectTrigger data-testid="select-product-store">
                    <SelectValue placeholder="Selecionar loja..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {STORE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} data-testid={`select-product-store-${opt.value}`}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="create-product-price">Preco Sugerido (R$)</Label>
                  <CurrencyInput id="create-product-price" value={formPrice} onChange={setFormPrice} data-testid="input-product-price" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="create-product-date">Data/Hora Entrada</Label>
                  <Input id="create-product-date" type="datetime-local" value={formDate} onChange={(e) => setFormDate(e.target.value)} data-testid="input-product-date" />
                </div>
              </div>
            </div>
          </DialogScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={submitCreate} disabled={createMutation.isPending || !formName.trim() || !formPrice} data-testid="button-submit-product">
              {createMutation.isPending ? "Salvando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editProduct} onOpenChange={(open) => { if (!open) setEditProduct(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
            <DialogDescription>Altere os dados do produto.</DialogDescription>
          </DialogHeader>
          <DialogScrollArea>
            <div className="space-y-3 pb-4">
              <div className="space-y-1">
                <Label htmlFor="edit-product-name">Nome</Label>
                <Input id="edit-product-name" value={formName} onChange={(e) => setFormName(e.target.value)} data-testid="input-edit-product-name" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-product-spec">Especificacao / Tamanho</Label>
                <Input id="edit-product-spec" value={formSpecification} onChange={(e) => setFormSpecification(e.target.value)} placeholder="Ex: 1cm, 80cm, 50kg, Azul" data-testid="input-edit-product-specification" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Unidade</Label>
                  <Select value={formUnit} onValueChange={setFormUnit}>
                    <SelectTrigger data-testid="select-edit-product-unit-trigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-product-qty">Quantidade</Label>
                  <Input id="edit-product-qty" type="number" min="0" value={formQuantity} onChange={(e) => setFormQuantity(e.target.value)} data-testid="input-edit-product-quantity" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Loja / Origem</Label>
                  <Select value={formStore} onValueChange={setFormStore}>
                    <SelectTrigger data-testid="select-edit-product-store">
                      <SelectValue placeholder="Selecionar loja..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {STORE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-product-price">Preco Sugerido (R$)</Label>
                  <CurrencyInput id="edit-product-price" value={formPrice} onChange={setFormPrice} data-testid="input-edit-product-price" />
                </div>
              </div>
            </div>
          </DialogScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProduct(null)}>Cancelar</Button>
            <Button onClick={submitEdit} disabled={updateMutation.isPending || !formName.trim() || !formPrice} data-testid="button-submit-edit-product">
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showExpenseDialog} onOpenChange={(open) => { if (!open) { setShowExpenseDialog(false); setPendingExpense(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ArrowDownCircle className="h-5 w-5 text-rose-500" />
              Lancar Despesa no Financeiro?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Deseja registrar esta compra como uma Saida no seu Painel Financeiro?</p>
                {pendingExpense && (
                  <div className="rounded-lg bg-muted p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm text-muted-foreground">Produto:</span>
                      <span className="font-medium text-foreground">{pendingExpense.name}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm text-muted-foreground">Quantidade:</span>
                      <span className="font-medium text-foreground">{pendingExpense.quantity} {formatUnit(pendingExpense.unit)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm text-muted-foreground">Preco unitario:</span>
                      <span className="font-medium text-foreground">{formatCurrency(pendingExpense.priceCents / 100)}</span>
                    </div>
                    <div className="border-t border-border/50 pt-1 mt-1 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">Valor total da compra:</span>
                      <span className="font-bold text-lg text-rose-600 dark:text-rose-400">
                        {formatCurrency((pendingExpense.quantity * pendingExpense.priceCents) / 100)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => { setPendingExpense(null); setShowExpenseDialog(false); }}
              data-testid="button-cancel-expense"
            >
              Nao, apenas cadastrar o produto
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingExpense) {
                  const totalCents = pendingExpense.quantity * pendingExpense.priceCents;
                  createExpenseMutation.mutate({
                    description: `Compra de produto - ${pendingExpense.name} (${pendingExpense.quantity} un.)`,
                    amount: totalCents,
                    type: "expense",
                    status: "pago",
                  } as any, {
                    onSettled: () => {
                      setPendingExpense(null);
                      setShowExpenseDialog(false);
                    },
                  });
                }
              }}
              disabled={createExpenseMutation.isPending}
              data-testid="button-confirm-expense"
            >
              {createExpenseMutation.isPending ? "Lancando..." : "Sim, lancar como Saida"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
