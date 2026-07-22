import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Cabeçalho de subsecção dentro de uma página ou tab.
 *
 * Barra com fundo `bg-muted` e contador em `bg-primary`, para separar
 * visualmente blocos de conteúdo com mais força do que um título solto.
 *
 * Uso:
 *   <SectionHeader
 *     titulo="Documentação interna"
 *     descricao="Visível apenas para a equipa interna."
 *     contador={3}
 *   />
 */
export function SectionHeader({
  titulo,
  descricao,
  contador,
  accao,
  className,
}: {
  titulo: string
  descricao?: string
  /** Contador à direita (ex: nº de itens da secção). */
  contador?: number
  /** Acção opcional à direita (botão, etc). Substitui o contador se ambos. */
  accao?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted px-4 py-2.5",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
        {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
      </div>

      {accao ??
        (contador !== undefined && (
          <span className="shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
            {contador}
          </span>
        ))}
    </div>
  )
}
