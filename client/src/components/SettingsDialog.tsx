import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSettings, useUpdateSettings } from "@/hooks/use-transactions";
import { Settings as SettingsIcon } from "lucide-react";

const formSchema = z.object({
  taxRate: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100, "Alíquota deve ser entre 0 e 100"),
});

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const { data: settings } = useSettings();
  const { mutate, isPending } = useUpdateSettings();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      taxRate: "15",
    },
  });

  // Update form when data loads
  useEffect(() => {
    if (settings) {
      form.setValue("taxRate", settings.taxRate.toString());
    }
  }, [settings, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    mutate({
      taxRate: values.taxRate,
    }, {
      onSuccess: () => {
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-xl border-border/60 hover:bg-muted">
          <SettingsIcon className="h-5 w-5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Configurações</DialogTitle>
          <DialogDescription>
            Ajuste os parâmetros fiscais da sua empresa.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <FormField
              control={form.control}
              name="taxRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alíquota de Imposto (%)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type="number" 
                        step="0.1" 
                        className="h-11 rounded-xl pr-8 font-mono" 
                        {...field} 
                      />
                      <span className="absolute right-3 top-3 text-sm text-muted-foreground">%</span>
                    </div>
                  </FormControl>
                  <FormDescription className="text-xs">
                    Percentual aplicado sobre todas as entradas para cálculo de impostos.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              disabled={isPending}
              className="w-full h-11 rounded-xl"
            >
              {isPending ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
