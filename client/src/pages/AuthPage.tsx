import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Layers, Mail, Lock, User, ArrowLeft } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("E-mail invalido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

const registerSchema = z.object({
  firstName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  lastName: z.string().min(2, "Sobrenome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail invalido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(6, "Confirme sua senha"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas nao coincidem",
  path: ["confirmPassword"],
});

const verifySchema = z.object({
  code: z.string().length(6, "O codigo deve ter 6 digitos"),
});

type AuthMode = "login" | "register" | "verify";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [userEmail, setUserEmail] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "", confirmPassword: "" },
  });

  const verifyForm = useForm<z.infer<typeof verifySchema>>({
    resolver: zodResolver(verifySchema),
    defaultValues: { code: "" },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: z.infer<typeof loginSchema>) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: (data) => {
      if (data.needsVerification) {
        setUserEmail(data.user.email);
        setMode("verify");
        toast({ title: "Verificacao necessaria", description: "Insira o codigo de verificacao enviado." });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        toast({ title: "Bem-vindo!", description: "Login realizado com sucesso." });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Erro no login", description: error.message, variant: "destructive" });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: z.infer<typeof registerSchema>) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: (data) => {
      setUserEmail(data.user.email);
      setMode("verify");
      toast({ title: "Cadastro realizado!", description: "Insira o codigo de verificacao para ativar sua conta." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro no cadastro", description: error.message, variant: "destructive" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof verifySchema>) => {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "E-mail verificado!", description: "Sua conta foi ativada com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro na verificacao", description: error.message, variant: "destructive" });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      toast({ title: "Codigo reenviado", description: "Um novo codigo de verificacao foi gerado." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Layers className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold">Gestor Pro</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md p-8">
          {mode === "login" && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="flex justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                    <Layers className="h-8 w-8" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold" data-testid="text-auth-title">Entrar no Sistema</h2>
                <p className="text-sm text-muted-foreground">Insira suas credenciais para acessar o painel.</p>
              </div>

              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit((d) => loginMutation.mutate(d))} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="seu@email.com" className="h-11 rounded-xl pl-9" data-testid="input-email" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input type="password" placeholder="Sua senha" className="h-11 rounded-xl pl-9" data-testid="input-password" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-11 rounded-xl" disabled={loginMutation.isPending} data-testid="button-login-submit">
                    {loginMutation.isPending ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </Form>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Nao possui uma conta?{" "}
                  <button
                    onClick={() => { setMode("register"); loginForm.reset(); }}
                    className="text-primary font-medium hover:underline"
                    data-testid="link-register"
                  >
                    Cadastre-se
                  </button>
                </p>
              </div>
            </div>
          )}

          {mode === "register" && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="flex justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                    <User className="h-8 w-8" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold" data-testid="text-auth-title">Criar Conta</h2>
                <p className="text-sm text-muted-foreground">Preencha os dados abaixo para se cadastrar.</p>
              </div>

              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit((d) => registerMutation.mutate(d))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={registerForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <Input placeholder="Seu nome" className="h-11 rounded-xl" data-testid="input-first-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sobrenome</FormLabel>
                          <FormControl>
                            <Input placeholder="Seu sobrenome" className="h-11 rounded-xl" data-testid="input-last-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={registerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="seu@email.com" className="h-11 rounded-xl pl-9" data-testid="input-register-email" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input type="password" placeholder="Minimo 6 caracteres" className="h-11 rounded-xl pl-9" data-testid="input-register-password" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar Senha</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input type="password" placeholder="Repita a senha" className="h-11 rounded-xl pl-9" data-testid="input-confirm-password" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-11 rounded-xl" disabled={registerMutation.isPending} data-testid="button-register-submit">
                    {registerMutation.isPending ? "Cadastrando..." : "Criar Conta"}
                  </Button>
                </form>
              </Form>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Ja possui uma conta?{" "}
                  <button
                    onClick={() => { setMode("login"); registerForm.reset(); }}
                    className="text-primary font-medium hover:underline"
                    data-testid="link-login"
                  >
                    Entrar
                  </button>
                </p>
              </div>
            </div>
          )}

          {mode === "verify" && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="flex justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                    <Mail className="h-8 w-8" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold" data-testid="text-auth-title">Verificar E-mail</h2>
                <p className="text-sm text-muted-foreground">
                  Insira o codigo de 6 digitos enviado para{" "}
                  <span className="font-medium text-foreground">{userEmail}</span>
                </p>
              </div>

              <Form {...verifyForm}>
                <form onSubmit={verifyForm.handleSubmit((d) => verifyMutation.mutate(d))} className="space-y-4">
                  <FormField
                    control={verifyForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Codigo de Verificacao</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="000000"
                            maxLength={6}
                            className="h-14 rounded-xl text-center text-2xl font-mono tracking-[0.5em]"
                            data-testid="input-verification-code"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-11 rounded-xl" disabled={verifyMutation.isPending} data-testid="button-verify-submit">
                    {verifyMutation.isPending ? "Verificando..." : "Verificar E-mail"}
                  </Button>
                </form>
              </Form>

              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => resendMutation.mutate()}
                  disabled={resendMutation.isPending}
                  className="text-sm text-primary font-medium hover:underline disabled:opacity-50"
                  data-testid="button-resend-code"
                >
                  {resendMutation.isPending ? "Reenviando..." : "Reenviar codigo"}
                </button>
                <button
                  onClick={() => { setMode("login"); verifyForm.reset(); }}
                  className="text-sm text-muted-foreground hover:underline flex items-center gap-1"
                  data-testid="link-back-login"
                >
                  <ArrowLeft className="h-3 w-3" /> Voltar ao login
                </button>
              </div>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
