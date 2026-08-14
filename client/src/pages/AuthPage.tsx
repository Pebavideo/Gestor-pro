import { Card } from "@/components/ui/card";
import { SiteFooter } from "@/components/SiteFooter";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Layers } from "lucide-react";

// Sem servidor (plano Spark), o login e feito 100% no client - so Google
// Sign-In (signInWithPopup ja verifica o e-mail automaticamente, sem
// precisar de senha nem de codigo de verificacao por e-mail).
export default function AuthPage() {
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
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                  <Layers className="h-8 w-8" />
                </div>
              </div>
              <h2 className="text-2xl font-bold" data-testid="text-auth-title">Entrar no Gestor Pro</h2>
              <p className="text-sm text-muted-foreground">
                Acesse com sua conta Google para gerenciar seu negocio.
              </p>
            </div>

            <GoogleSignInButton label="Entrar com Google" testId="button-google-login" />

            <p className="text-xs text-center text-muted-foreground">
              Ao continuar, voce concorda com nossos{" "}
              <a href="/termos" className="text-primary hover:underline">Termos de Uso</a>
              {" "}e nossa{" "}
              <a href="/privacidade" className="text-primary hover:underline">Politica de Privacidade</a>.
            </p>
          </div>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
