import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Layers, TrendingUp, ShieldCheck, BarChart3 } from "lucide-react";

export default function Landing() {
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
            <a href="/api/login">
              <Button data-testid="button-login">Entrar</Button>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-2xl text-center space-y-6">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Layers className="h-9 w-9" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Gestor de Empresas <span className="text-primary">Pro</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Controle financeiro completo para sua empresa. Gerencie entradas, saidas, impostos e muito mais em um painel simples e seguro.
          </p>
          <a href="/api/login">
            <Button size="lg" className="mt-4 px-8 text-base" data-testid="button-login-hero">
              Acessar o Sistema
            </Button>
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 max-w-3xl w-full">
          <Card className="p-6 text-center space-y-3">
            <div className="flex justify-center">
              <div className="p-3 rounded-xl bg-emerald-500/10">
                <TrendingUp className="h-6 w-6 text-emerald-500" />
              </div>
            </div>
            <h3 className="font-semibold">Fluxo de Caixa</h3>
            <p className="text-sm text-muted-foreground">Acompanhe entradas e saidas em tempo real.</p>
          </Card>
          <Card className="p-6 text-center space-y-3">
            <div className="flex justify-center">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <BarChart3 className="h-6 w-6 text-blue-500" />
              </div>
            </div>
            <h3 className="font-semibold">Impostos</h3>
            <p className="text-sm text-muted-foreground">Calcule impostos automaticamente sobre o faturamento.</p>
          </Card>
          <Card className="p-6 text-center space-y-3">
            <div className="flex justify-center">
              <div className="p-3 rounded-xl bg-amber-500/10">
                <ShieldCheck className="h-6 w-6 text-amber-500" />
              </div>
            </div>
            <h3 className="font-semibold">Multi-Usuario</h3>
            <p className="text-sm text-muted-foreground">Admin e Operador com dados isolados e permissoes dedicadas.</p>
          </Card>
        </div>
      </main>
    </div>
  );
}
