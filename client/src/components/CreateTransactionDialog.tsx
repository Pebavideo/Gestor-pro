import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/hooks/use-transactions";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CurrencyInput, parseBRL, formatBRL } from "@/components/CurrencyInput";
import { Plus, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@shared/schema";
import { CATEGORY_OPTIONS, getCategoryLabel } from "@shared/schema";

export const STORE_OPTIONS = [
  { value: "fazenda", label: "Fazenda" },
  { value: "loja_manel", label: "Loja do Manel" },
  { value: "loja_maria", label: "Loja da Maria" },
  { value: "mercado_ze", label: "Mercado do Ze" },
];

export function getStoreLabel(value: string | null | undefined): string {
  if (!value) return "";
  const found = STORE_OPTIONS.find((o) => o.value === value);
  return found ? found.label : value;
}

const formSchema = z.object({
  description: z.string().min(3, "Descricao muito curta"),
  amount: z.string().refine((val) => {
    const cleaned = val.replace(/\./g, "").replace(",", ".");
    return !isNaN(parseFloat(cleaned)) && parseFloat(cleaned) > 0;
  }, "Valor deve ser maior que 0"),
  type: z.enum(["income", "expense"]),
  category: z.string().optional(),
  store: z.string().optional(),
  productId: z.string().optional(),
  productQty: z.string().optional(),
});

export function CreateTransactionDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: {
      description: string;
      amount: number;
      type: string;
      productId?: number;
      productQty?: number;
    }) => {
      const res = await apiRequest("POST", "/api/transactions", payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Transacao registrada",
        description: "A movimentacao foi salva com sucesso.",
      });
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      amount: "",
      type: "income",
      category: "none",
      store: "none",
      productId: "",
      productQty: "1",
    },
  });

  const watchType = form.watch("type");
  const watchProductId = form.watch("productId");

  const selectedProduct = watchProductId && watchProductId !== "none"
    ? products.find((p) => p.id === parseInt(watchProductId))
    : null;

  function onSubmit(values: z.infer<typeof formSchema>) {
    const amountInCents = Math.round(parseBRL(values.amount) * 100);

    const payload: {
      description: string;
      amount: number;
      type: string;
      category?: string;
      store?: string;
      productId?: number;
      productQty?: number;
    } = {
      description: values.description,
      amount: amountInCents,
      type: values.type,
    };

    if (values.category && values.category !== "none") {
      payload.category = values.category;
    }

    if (values.store && values.store !== "none") {
      payload.store = values.store;
    }

    if (values.type === "income" && values.productId && values.productId !== "none") {
      payload.productId = parseInt(values.productId);
      payload.productQty = parseInt(values.productQty || "1") || 1;
    }

    createMutation.mutate(payload);
  }

  function onProductSelect(productId: string) {
    form.setValue("productId", productId);
    if (productId && productId !== "none") {
      const product = products.find((p) => p.id === parseInt(productId));
      if (product) {
        form.setValue("description", `Venda - ${product.name}`);
        form.setValue("amount", formatBRL(product.price / 100));
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl px-6" data-testid="button-new-transaction">
          <Plus className="mr-2 h-5 w-5" /> Nova Transacao
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-2xl font-bold">Nova Transacao</DialogTitle>
          <DialogDescription>
            Registre uma entrada ou saida financeira.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div>
                        <RadioGroupItem value="income" id="income" className="peer sr-only" />
                        <TypeLabel
                          htmlFor="income"
                          icon={ArrowUpCircle}
                          title="Entrada"
                          description="Vendas, servicos..."
                          colorClass="peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-50 peer-data-[state=checked]:text-emerald-700 text-emerald-600"
                        />
                      </div>
                      <div>
                        <RadioGroupItem value="expense" id="expense" className="peer sr-only" />
                        <TypeLabel
                          htmlFor="expense"
                          icon={ArrowDownCircle}
                          title="Saida"
                          description="Custos, despesas..."
                          colorClass="peer-data-[state=checked]:border-rose-500 peer-data-[state=checked]:bg-rose-50 peer-data-[state=checked]:text-rose-700 text-rose-600"
                        />
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="store"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loja / Origem</FormLabel>
                  <Select value={field.value || "none"} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-store">
                        <SelectValue placeholder="Selecionar loja..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {STORE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} data-testid={`option-store-${opt.value}`}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select value={field.value || "none"} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder="Selecionar categoria..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} data-testid={`option-category-${opt.value}`}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchType === "income" && products.length > 0 && (
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Produto (opcional)</FormLabel>
                    <Select value={field.value || "none"} onValueChange={onProductSelect}>
                      <FormControl>
                        <SelectTrigger data-testid="select-product">
                          <SelectValue placeholder="Selecionar produto..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhum produto</SelectItem>
                        {products.filter((p) => p.quantity > 0).map((p) => (
                          <SelectItem key={p.id} value={String(p.id)} data-testid={`option-product-${p.id}`}>
                            {p.name} ({p.quantity} un.) - {formatCurrency(p.price / 100)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {watchType === "income" && selectedProduct && (
              <FormField
                control={form.control}
                name="productQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade vendida</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max={selectedProduct.quantity}
                        {...field}
                        data-testid="input-product-qty"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descricao</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Venda de Consultoria" {...field} data-testid="input-transaction-description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value}
                      onChange={field.onChange}
                      className="font-mono text-lg"
                      data-testid="input-transaction-amount"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

          </form>
        </Form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            data-testid="button-cancel-transaction"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending}
            onClick={form.handleSubmit(onSubmit)}
            data-testid="button-submit-transaction"
          >
            {createMutation.isPending ? "Salvando..." : "Confirmar Transacao"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TypeLabel({ htmlFor, icon: Icon, title, description, colorClass }: any) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-transparent p-4 cursor-pointer transition-all duration-200 h-full text-center",
        colorClass
      )}
    >
      <Icon className="mb-2 h-6 w-6" />
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs opacity-70 mt-1">{description}</span>
    </label>
  );
}
