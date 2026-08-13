import { Link } from "wouter";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/40 mt-auto">
      <div className="container mx-auto px-3 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-muted-foreground text-center">
        <span>Gestor Pro - Todos os direitos reservados.</span>
        <span className="hidden sm:inline">-</span>
        <Link href="/privacidade" className="hover:text-foreground hover:underline" data-testid="link-footer-privacy">
          Politica de Privacidade
        </Link>
        <span className="hidden sm:inline">-</span>
        <Link href="/termos" className="hover:text-foreground hover:underline" data-testid="link-footer-terms">
          Termos de Uso
        </Link>
      </div>
    </footer>
  );
}
