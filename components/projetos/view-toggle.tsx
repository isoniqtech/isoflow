import Link from "next/link"
import { LayoutGrid, List } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Alternador entre vista em grelha e vista em lista.
 *
 * Navega por searchParams (`?vista=lista`), como o resto da app, para tudo
 * continuar Server Component e a escolha ser partilhável por URL.
 * Segue a linguagem do SegmentedTabs.
 */

export type VistaProjetos = "grelha" | "lista"

export function ViewToggle({
  vista,
  hrefFor,
}: {
  vista: VistaProjetos
  hrefFor: (v: VistaProjetos) => string
}) {
  const opcoes: { id: VistaProjetos; label: string; Icon: typeof LayoutGrid }[] = [
    { id: "grelha", label: "Grelha", Icon: LayoutGrid },
    { id: "lista", label: "Lista", Icon: List },
  ]

  return (
    <div className="inline-flex gap-1 rounded-lg border border-border/60 bg-muted p-1">
      {opcoes.map(({ id, label, Icon }) => (
        <Link
          key={id}
          href={hrefFor(id)}
          aria-current={vista === id ? "page" : undefined}
          title={`Ver em ${label.toLowerCase()}`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
            vista === id
              ? "bg-card text-foreground shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.08))]"
              : "text-muted-foreground hover:bg-card/50 hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </Link>
      ))}
    </div>
  )
}
