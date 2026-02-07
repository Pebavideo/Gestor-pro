import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCreateTransaction } from "@/hooks/use-transactions";
import { Plus, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  description: z.string().min(3, "Descrição muito curta"),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Valor deve ser maior que 0"),
  type: z.enum(["income", "expense"]),
});

export function CreateTransactionDialog() {
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useCreateTransaction();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      amount: "",
      type: "income",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    // Convert string amount to cents integer
    const amountInCents = Math.round(parseFloat(values.amount.replace(",", ".")) * 100);
    
    mutate({
      description: values.description,
      amount: amountInCents,
      type: values.type,
      date: new Date(),
    }, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="rounded-xl px-6 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300">
          <Plus className="mr-2 h-5 w-5" /> Nova Transação
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-2xl border-none shadow-2xl">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-2xl font-display font-bold">Nova Transação</DialogTitle>
          <DialogDescription>
            Registre uma entrada ou saída financeira.
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
                        <Label
                          htmlFor="income"
                          icon={ArrowUpCircle}
                          title="Entrada"
                          description="Vendas, serviços..."
                          colorClass="peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-50 peer-data-[state=checked]:text-emerald-700 text-emerald-600"
                        />
                      </div>
                      <div>
                        <RadioGroupItem value="expense" id="expense" className="peer sr-only" />
                        <Label
                          htmlFor="expense"
                          icon={ArrowDownCircle}
                          title="Saída"
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Venda de Consultoria" className="h-11 rounded-xl" {...field} />
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
                    <Input 
                      type="number" 
                      step="0.01" 
                      placeholder="0.00" 
                      className="h-11 rounded-xl font-mono text-lg" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-2">
              <Button 
                type="submit" 
                disabled={isPending}
                className="w-full h-11 rounded-xl text-base font-semibold bg-primary hover:bg-primary/90"
              >
                {isPending ? "Salvando..." : "Confirmar Transação"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Helper component for radio cards
function Label({ htmlFor, icon: Icon, title, description, colorClass }: any) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-transparent p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all duration-200 h-full text-center",
        colorClass
      )}
    >
      <Icon className="mb-2 h-6 w-6" />
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs opacity-70 mt-1">{description}</span>
    </label>
  );
}
