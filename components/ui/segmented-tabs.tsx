import Link from "next/link"
import { cn } from "@/lib/utils"

/**
 * Navegação por tabs em controlo segmentado.
 *
 * Padrão visual da app para separadores de página: fundo `bg-muted` e a tab
 * activa levantada em `bg-card` com sombra, para se perceber de imediato onde
 * se está (mais contraste do que um simples sublinhado).
 *
 * Mantém o padrão de navegação por `searchParams` usado na app: cada tab é um
 * Link com URL própria, tudo continua Server Component e a tab é partilhável.
 *
 * Uso:
 *   <SegmentedTabs
 *     tabs={[{ id: "dashboard", label: "Dashboard" }, ...]}
 *     activeId={activeTab}
 *     hrefFor={(id) => `/projetos/${id}?tab=${id}`}
 *   />
 */

export type SegmentedTab = {
  id: string
  label: string
  /** Contador opcional à direita do rótulo (ex: nº de itens). */
  count?: number
}

export function SegmentedTabs({
  tabs,
  activeId,
  hrefFor,
  className,
}: {
  tabs: readonly SegmentedTab[]
  activeId: string
  hrefFor: (id: string) => string
  className?: string
}) {
  return (
    <nav
      className={cn(
        "inline-flex gap-1 rounded-lg border border-border/60 bg-muted p-1",
        className,
      )}
    >
      {tabs.map((tab) => {
        const activa = tab.id === activeId
        return (
          <Link
            key={tab.id}
            href={hrefFor(tab.id)}
            aria-current={activa ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              activa
                ? "bg-card text-foreground shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.08))]"
                : "text-muted-foreground hover:bg-card/50 hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-xs font-semibold",
                  activa ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground",
                )}
              >
                {tab.count}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
