import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Layers, ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

interface LegalPageLayoutProps {
  title: string;
  updatedAt: string;
  children: ReactNode;
}

export function LegalPageLayout({ title, updatedAt, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="w-full border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-3" data-testid="link-legal-home">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold">Gestor Pro</span>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-10 sm:py-14">
        <div className="container mx-auto max-w-3xl">
          <div className="bg-card border border-border/50 rounded-2xl shadow-sm p-6 sm:p-10">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground" data-testid="text-legal-title">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">Ultima atualizacao: {updatedAt}</p>

            <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none mt-8 text-foreground prose-headings:font-display prose-headings:font-bold prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
              {children}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/40 py-6">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <span>Gestor Pro - Todos os direitos reservados.</span>
        </div>
      </footer>
    </div>
  );
}
