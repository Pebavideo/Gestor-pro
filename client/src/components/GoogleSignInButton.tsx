import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// Codigos de erro do Firebase que representam o usuario simplesmente
// desistindo do popup (fechou, clicou fora, abriu um segundo popup antes
// do primeiro terminar) - nao sao falhas reais, entao nao mostramos toast
// de erro para nao quebrar/assustar a tela por uma acao intencional.
const SILENT_CANCEL_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
]);

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.8z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.1C3.25 21.3 7.28 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28v-3.1H1.27A11.97 11.97 0 0 0 0 12c0 1.93.46 3.76 1.27 5.38l4-3.1z" />
      <path fill="#EA4335" d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.28 0 3.25 2.7 1.27 6.62l4 3.1C6.22 6.88 8.87 4.77 12 4.77z" />
    </svg>
  );
}

interface GoogleSignInButtonProps {
  label?: string;
  testId?: string;
}

export function GoogleSignInButton({ label = "Entrar com Google", testId = "button-google-signin" }: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleClick() {
    setLoading(true);
    try {
      // O listener de onIdTokenChanged em lib/firebase.ts ja invalida as
      // queries de auth automaticamente assim que o popup fecha com sucesso.
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code && SILENT_CANCEL_CODES.has(code)) {
        return;
      }
      if (code === "auth/popup-blocked") {
        toast({
          title: "Popup bloqueado",
          description: "Seu navegador bloqueou a janela do Google. Permita popups para este site e tente novamente.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Erro ao entrar com Google",
        description: (err as { message?: string })?.message || "Nao foi possivel completar o login. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full h-11 rounded-xl"
      onClick={handleClick}
      disabled={loading}
      data-testid={testId}
    >
      <GoogleIcon />
      <span className="ml-2">{loading ? "Conectando..." : label}</span>
    </Button>
  );
}
