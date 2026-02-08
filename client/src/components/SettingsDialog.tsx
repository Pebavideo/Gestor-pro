import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogScrollArea, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSettings, useUpdateSettings } from "@/hooks/use-transactions";
import { Settings as SettingsIcon } from "lucide-react";

const formSchema = z.object({
  taxRate: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 100, "Aliquota deve ser entre 0 e 100"),
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
        <Button variant="ghost" className="w-full justify-start gap-3" data-testid="button-settings">
          <SettingsIcon className="h-4 w-4" />
          Configuracoes
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Configuracoes</DialogTitle>
          <DialogDescription>
            Ajuste os parametros fiscais da sua empresa.
          </DialogDescription>
        </DialogHeader>

        <DialogScrollArea>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-4">
              <FormField
                control={form.control}
                name="taxRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aliquota de Imposto (%)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.1"
                          className="pr-8 font-mono"
                          {...field}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs">
                      Percentual aplicado sobre todas as entradas para calculo de impostos.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </DialogScrollArea>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            data-testid="button-cancel-settings"
          >
            Cancelar
          </Button>
          <Button
            disabled={isPending}
            onClick={form.handleSubmit(onSubmit)}
            data-testid="button-submit-settings"
          >
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
