import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogScrollArea, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCreateTransaction } from "@/hooks/use-transactions";
import { useProducts } from "@/hooks/use-products";
import { CurrencyInput, parseBRL, formatBRL } from "@/components/CurrencyInput";
import { Plus, ArrowUpCircle, ArrowDownCircle, Repeat, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_OPTIONS, getCategoryLabel, RECURRENCE_OPTIONS, STORE_OPTIONS, getStoreLabel } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

export { STORE_OPTIONS, getStoreLabel };

const formSchema = z.object({
  description: z.string().min(3, "Descricao muito curta"),
  amount: z.string().refine((val) => {
    const cleaned = val.replace(/\./g, "").replace(",", ".");
    return !isNaN(parseFloat(cleaned)) && parseFloat(cleaned) > 0;
  }, "Valor deve ser maior que 0"),
  type: z.enum(["income", "expense"]),
  category: z.string().optional(),
  store: z.string().optional(),
  status: z.enum(["pago", "pendente"]),
  dueDate: z.string().optional(),
  paymentDate: z.string().optional(),
  isRecurring: z.boolean(),
  recurrenceFrequency: z.string().optional(),
  recurrenceCount: z.string().optional(),
  productId: z.string().optional(),
  productQty: z.string().optional(),
});

export function CreateTransactionDialog() {
  const [open, setOpen] = useState(false);
  const { isMaster, userStore } = useAuth();

  const { data: products = [] } = useProducts();

  const createMutation = useCreateTransaction();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      amount: "",
      type: "expense",
      category: "none",
      store: "none",
      status: "pago",
      dueDate: "",
      paymentDate: "",
      isRecurring: false,
      recurrenceFrequency: "mensal",
      recurrenceCount: "1",
      productId: "",
      productQty: "1",
    },
  });

  const watchType = form.watch("type");
  const watchProductId = form.watch("productId");
  const watchStatus = form.watch("status");
  const watchIsRecurring = form.watch("isRecurring");

  const selectedProduct = watchProductId && watchProductId !== "none"
    ? products.find((p) => p.id === watchProductId)
    : null;

  function onSubmit(values: z.infer<typeof formSchema>) {
    const amountInCents = Math.round(parseBRL(values.amount) * 100);

    const payload: any = {
      description: values.description,
      amount: amountInCents,
      type: values.type,
      status: values.status,
    };

    if (values.category && values.category !== "none") {
      payload.category = values.category;
    }
    if (!isMaster && userStore) {
      payload.store = userStore;
    } else if (values.store && values.store !== "none") {
      payload.store = values.store;
    }

    if (values.status === "pendente" && values.dueDate) {
      payload.dueDate = values.dueDate;
    }
    if (values.status === "pago" && values.paymentDate) {
      payload.paymentDate = values.paymentDate;
    } else if (values.status === "pago") {
      payload.paymentDate = new Date().toISOString();
    }

    if (values.isRecurring) {
      payload.isRecurring = 1;
      payload.recurrenceFrequency = values.recurrenceFrequency || "mensal";
      payload.recurrenceCount = parseInt(values.recurrenceCount || "1") || 1;
    }

    if (values.type === "income" && values.productId && values.productId !== "none") {
      payload.productId = values.productId;
      payload.productQty = parseInt(values.productQty || "1") || 1;
    }

    createMutation.mutate(payload, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      },
    });
  }

  function onProductSelect(productId: string) {
    form.setValue("productId", productId);
    if (productId && productId !== "none") {
      const product = products.find((p) => p.id === productId);
      if (product) {
        form.setValue("description", `Venda - ${product.name}`);
        form.setValue("amount", formatBRL(product.price / 100));
      }
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Sempre limpa o formulario ao fechar (ESC, clique fora, ou
      // Cancelar) - sem isso o proximo "Nova Transacao" reabria com os
      // valores antigos ainda preenchidos.
      form.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="rounded-xl px-6" data-testid="button-new-transaction">
          <Plus className="mr-2 h-5 w-5" /> Nova Transacao
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Nova Transacao</DialogTitle>
          <DialogDescription>
            Registre uma entrada ou saida financeira.
          </DialogDescription>
        </DialogHeader>

        <DialogScrollArea>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 pb-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="grid grid-cols-2 gap-3"
                      >
                        <div>
                          <RadioGroupItem value="income" id="income" className="peer sr-only" />
                          <TypeLabel
                            htmlFor="income"
                            icon={ArrowUpCircle}
                            title="Entrada"
                            colorClass="peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-50 peer-data-[state=checked]:text-emerald-700 text-emerald-600"
                          />
                        </div>
                        <div>
                          <RadioGroupItem value="expense" id="expense" className="peer sr-only" />
                          <TypeLabel
                            htmlFor="expense"
                            icon={ArrowDownCircle}
                            title="Saida"
                            colorClass="peer-data-[state=checked]:border-rose-500 peer-data-[state=checked]:bg-rose-50 peer-data-[state=checked]:text-rose-700 text-rose-600"
                          />
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descricao</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Aluguel" {...field} data-testid="input-transaction-description" />
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
                          className="font-mono"
                          data-testid="input-transaction-amount"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Status
                      </FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pago" data-testid="option-status-pago">Pago/Recebido</SelectItem>
                          <SelectItem value="pendente" data-testid="option-status-pendente">Pendente</SelectItem>
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
                            <SelectValue placeholder="Selecionar..." />
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
              </div>

              {watchStatus === "pendente" && (
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Vencimento</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-due-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {watchStatus === "pago" && (
                <FormField
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Pagamento (opcional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-payment-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {isMaster ? (
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
              ) : userStore ? (
                <div className="space-y-1">
                  <FormLabel>Unidade</FormLabel>
                  <div className="p-2 text-sm bg-muted rounded-md" data-testid="text-assigned-store">
                    {getStoreLabel(userStore)}
                  </div>
                </div>
              ) : null}

              {watchType === "income" && products.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="productId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Produto (opcional)</FormLabel>
                        <Select value={field.value || "none"} onValueChange={onProductSelect}>
                          <FormControl>
                            <SelectTrigger data-testid="select-product">
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {products.filter((p) => p.quantity > 0).map((p) => (
                              <SelectItem key={p.id} value={String(p.id)} data-testid={`option-product-${p.id}`}>
                                {p.name} ({p.quantity} un.)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {selectedProduct && (
                    <FormField
                      control={form.control}
                      name="productQty"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantidade</FormLabel>
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
                </div>
              )}

              <div className="border rounded-lg p-2.5 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-sm font-medium">Recorrente</Label>
                  </div>
                  <FormField
                    control={form.control}
                    name="isRecurring"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-y-0">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-recurring"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {watchIsRecurring && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <FormField
                      control={form.control}
                      name="recurrenceFrequency"
                      render={({ field }) => (
                        <FormItem className="flex-1 min-w-[120px]">
                          <Select value={field.value || "mensal"} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-recurrence-frequency">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {RECURRENCE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="recurrenceCount"
                      render={({ field }) => (
                        <FormItem className="w-[80px]">
                          <FormControl>
                            <Input
                              type="number"
                              min="2"
                              max="36"
                              placeholder="Meses"
                              {...field}
                              data-testid="input-recurrence-count"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">vezes</span>
                  </div>
                )}
              </div>

            </form>
          </Form>
        </DialogScrollArea>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
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

function TypeLabel({ htmlFor, icon: Icon, title, colorClass }: any) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl border-2 border-muted bg-transparent p-3 cursor-pointer transition-all duration-200 text-center",
        colorClass
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-sm font-semibold">{title}</span>
    </label>
  );
}
