import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/hooks/use-transactions";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Pencil, Trash2, Inbox, Banknote, DollarSign } from "lucide-react";
import { CurrencyInput, parseBRL, centsToFormatted } from "@/components/CurrencyInput";
import type { Employee } from "@shared/schema";

const employeeFormSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  position: z.string().min(2, "Cargo deve ter pelo menos 2 caracteres"),
  salary: z.string().min(1, "Salario e obrigatorio").refine((val) => {
    const cleaned = val.replace(/\./g, "").replace(",", ".");
    return !isNaN(parseFloat(cleaned)) && parseFloat(cleaned) > 0;
  }, "Salario deve ser maior que 0"),
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;

function useEmployees() {
  return useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar funcionarios");
      return res.json();
    },
  });
}

export default function TeamManagement() {
  const { isAdmin } = useAuth();
  const { data: employees, isLoading } = useEmployees();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const createForm = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: { name: "", position: "", salary: "" },
  });

  const editForm = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: { name: "", position: "", salary: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      const salaryInCents = Math.round(parseBRL(data.salary) * 100);
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, position: data.position, salary: salaryInCents }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Funcionario cadastrado", description: "O funcionario foi adicionado com sucesso." });
      createForm.reset();
      setCreateOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EmployeeFormData }) => {
      const salaryInCents = Math.round(parseBRL(data.salary) * 100);
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, position: data.position, salary: salaryInCents }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Funcionario atualizado", description: "Os dados foram salvos com sucesso." });
      setEditingEmployee(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/employees/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) {
        const err = await res.json();
        throw new Error(err.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Funcionario removido", description: "O registro foi desativado." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const payrollMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/employees/payroll", {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      toast({ title: "Folha processada", description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const payEmployeeMutation = useMutation({
    mutationFn: async (employeeId: number) => {
      const res = await fetch(`/api/employees/${employeeId}/pay`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
      toast({ title: "Pagamento lancado", description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  function openEdit(emp: Employee) {
    setEditingEmployee(emp);
    editForm.reset({
      name: emp.name,
      position: emp.position,
      salary: centsToFormatted(emp.salary),
    });
  }

  const totalPayroll = employees?.reduce((sum, emp) => sum + emp.salary, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-team-title">Gestao de Equipe</h2>
          <p className="text-muted-foreground mt-1">Gerencie seus funcionarios e folha de pagamento.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={payrollMutation.isPending || !employees?.length}
                    data-testid="button-process-payroll"
                  >
                    <Banknote className="h-4 w-4 mr-2" />
                    {payrollMutation.isPending ? "Processando..." : "Lancar Pagamento do Mes"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Lancar Folha de Pagamento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Sera criado um lancamento de saida para cada funcionario ativo, totalizando{" "}
                      <span className="font-semibold text-foreground">{formatCurrency(totalPayroll / 100)}</span>.
                      Esta acao sera registrada no fluxo de caixa.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => payrollMutation.mutate()}
                      data-testid="button-confirm-payroll"
                    >
                      Confirmar Pagamento
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-employee">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Funcionario
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cadastrar Funcionario</DialogTitle>
                  </DialogHeader>
                  <Form {...createForm}>
                    <form onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                      <FormField
                        control={createForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome completo" data-testid="input-employee-name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="position"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cargo</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Desenvolvedor, Gerente..." data-testid="input-employee-position" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="salary"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Salario Mensal (R$)</FormLabel>
                            <FormControl>
                              <CurrencyInput value={field.value} onChange={field.onChange} data-testid="input-employee-salary" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-employee">
                        {createMutation.isPending ? "Salvando..." : "Cadastrar"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Funcionarios</p>
              <p className="text-2xl font-bold" data-testid="text-employee-count">{employees?.length || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Folha Mensal</p>
              <p className="text-2xl font-bold" data-testid="text-total-payroll">{formatCurrency(totalPayroll / 100)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Salario Medio</p>
              <p className="text-2xl font-bold" data-testid="text-avg-salary">
                {employees?.length ? formatCurrency(totalPayroll / employees.length / 100) : formatCurrency(0)}
              </p>
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
      ) : !employees || employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8 opacity-50" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Nenhum funcionario cadastrado</h3>
          <p className="max-w-xs mx-auto mt-2">
            {isAdmin
              ? "Clique em 'Novo Funcionario' para adicionar membros da equipe."
              : "Nenhum funcionario foi cadastrado pelo administrador."}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden sm:block rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="pl-6">Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">Salario Mensal</TableHead>
                  {isAdmin && <TableHead className="text-right pr-6">Acoes</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow
                    key={emp.id}
                    className="hover:bg-muted/30 border-border/50 transition-colors"
                    data-testid={`row-employee-${emp.id}`}
                  >
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <Users className="w-4 h-4" />
                        </div>
                        <span className="font-medium" data-testid={`text-employee-name-${emp.id}`}>{emp.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" data-testid={`text-employee-position-${emp.id}`}>
                        {emp.position}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium" data-testid={`text-employee-salary-${emp.id}`}>
                      {formatCurrency(emp.salary / 100)}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(emp)}
                            data-testid={`button-edit-employee-${emp.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={payEmployeeMutation.isPending}
                                data-testid={`button-pay-employee-${emp.id}`}
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Lancar Pagamento Individual</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Sera criado um lancamento de saida no valor de{" "}
                                  <span className="font-semibold text-foreground">{formatCurrency(emp.salary / 100)}</span>{" "}
                                  referente ao salario de <span className="font-semibold text-foreground">{emp.name}</span>.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => payEmployeeMutation.mutate(emp.id)}
                                  data-testid={`button-confirm-pay-employee-${emp.id}`}
                                >
                                  Confirmar Pagamento
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-delete-employee-${emp.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover funcionario?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  O funcionario <span className="font-semibold">{emp.name}</span> sera desativado e nao aparecera mais na folha de pagamento.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(emp.id)}
                                  className="bg-destructive"
                                  data-testid={`button-confirm-delete-employee-${emp.id}`}
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
            {employees.map((emp) => (
              <Card key={emp.id} className="p-4" data-testid={`card-employee-${emp.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate" data-testid={`card-text-employee-name-${emp.id}`}>{emp.name}</p>
                      <Badge variant="secondary" className="mt-1" data-testid={`card-text-employee-position-${emp.id}`}>
                        {emp.position}
                      </Badge>
                    </div>
                  </div>
                  <Badge variant={emp.active === 1 ? "default" : "secondary"} data-testid={`card-badge-status-${emp.id}`}>
                    {emp.active === 1 ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                  <p className="font-mono font-medium text-lg" data-testid={`card-text-employee-salary-${emp.id}`}>
                    {formatCurrency(emp.salary / 100)}
                  </p>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(emp)}
                        data-testid={`card-button-edit-employee-${emp.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={payEmployeeMutation.isPending}
                            data-testid={`card-button-pay-employee-${emp.id}`}
                          >
                            <DollarSign className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Lancar Pagamento Individual</AlertDialogTitle>
                            <AlertDialogDescription>
                              Sera criado um lancamento de saida no valor de{" "}
                              <span className="font-semibold text-foreground">{formatCurrency(emp.salary / 100)}</span>{" "}
                              referente ao salario de <span className="font-semibold text-foreground">{emp.name}</span>.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => payEmployeeMutation.mutate(emp.id)}
                              data-testid={`card-button-confirm-pay-employee-${emp.id}`}
                            >
                              Confirmar Pagamento
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`card-button-delete-employee-${emp.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover funcionario?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O funcionario <span className="font-semibold">{emp.name}</span> sera desativado e nao aparecera mais na folha de pagamento.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(emp.id)}
                              className="bg-destructive"
                              data-testid={`card-button-confirm-delete-employee-${emp.id}`}
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={!!editingEmployee} onOpenChange={(open) => !open && setEditingEmployee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Funcionario</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit((d) =>
                editingEmployee && editMutation.mutate({ id: editingEmployee.id, data: d })
              )}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input data-testid="input-edit-employee-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo</FormLabel>
                    <FormControl>
                      <Input data-testid="input-edit-employee-position" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="salary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salario Mensal (R$)</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value} onChange={field.onChange} data-testid="input-edit-employee-salary" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={editMutation.isPending} data-testid="button-submit-edit-employee">
                {editMutation.isPending ? "Salvando..." : "Salvar Alteracoes"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
