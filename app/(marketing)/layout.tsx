import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
              I
            </div>
            <span className="font-semibold tracking-tight text-lg">ISOFlow</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#como-funciona" className="hover:text-foreground transition-colors">Como funciona</a>
            <a href="#precos" className="hover:text-foreground transition-colors">Preços</a>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Entrar</Link>
            </Button>
            <Button size="sm" asChild>
              <a href="#contacto">Pedir demo</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t bg-muted/30 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-6 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                  I
                </div>
                <span className="font-semibold">ISOFlow</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Plataforma portuguesa para gestão automática de faturas, conciliação bancária e controlo de obras.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium mb-3">Produto</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a></li>
                <li><a href="#precos" className="hover:text-foreground transition-colors">Preços</a></li>
                <li><a href="#como-funciona" className="hover:text-foreground transition-colors">Como funciona</a></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium mb-3">Empresa</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>ISONIQ TECH</li>
                <li>
                  <a href="mailto:geral@isoniqtech.com" className="hover:text-foreground transition-colors">
                    geral@isoniqtech.com
                  </a>
                </li>
                <li>Portugal</li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} ISONIQ TECH. Todos os direitos reservados.</p>
            <p>Desenvolvido e alojado na União Europeia · RGPD</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
