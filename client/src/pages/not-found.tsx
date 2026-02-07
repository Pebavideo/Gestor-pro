import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center text-center space-y-6 max-w-md animate-in">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="w-12 h-12" />
        </div>
        
        <h1 className="text-4xl font-display font-bold text-foreground">404 Página não encontrada</h1>
        <p className="text-muted-foreground text-lg">
          Ocorreu um erro ou a página que você está procurando não existe.
        </p>

        <Link href="/">
          <Button size="lg" className="rounded-xl px-8 mt-4 font-semibold">
            Voltar para o Painel
          </Button>
        </Link>
      </div>
    </div>
  );
}
