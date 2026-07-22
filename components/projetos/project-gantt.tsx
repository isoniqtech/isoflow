"use client"

/**
 * Gantt do planeamento, agrupado por fases.
 *
 * Cada fase tem cor própria e uma barra-resumo que vai do início da primeira
 * tarefa ao fim da última. As tarefas ficam por baixo, indentadas, na mesma cor
 * mas mais clara, para se perceber de imediato a que fase pertencem.
 *
 * A coluna dos nomes é fixa e a linha do tempo faz scroll horizontal, para
 * cronogramas longos continuarem legíveis. Cabeçalho e linhas partilham o mesmo
 * contentor de scroll, senão a escala de meses desalinhava das barras.
 */

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/portugal"
import type { Tarefa } from "@/components/projetos/project-plan-tab"

const DIA_MS = 86_400_000

/** Cores das fases. Ciclam se houver mais fases do que cores. */
const CORES_FASE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const

const SEM_FASE = "Sem fase"

const STATUS_LABELS: Record<Tarefa["status"], string> = {
  por_iniciar: "Por iniciar",
  em_curso: "Em curso",
  concluida: "Concluída",
  bloqueada: "Bloqueada",
}

type Grupo = {
  nome: string
  cor: string
  tarefas: Tarefa[]
  /** null quando nenhuma tarefa da fase tem datas. */
  inicio: number | null
  fim: number | null
}

/** Meia-noite local do dia da data (as datas vêm em YYYY-MM-DD). */
function aoDia(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number)
  return new Date(a, m - 1, d).getTime()
}

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
]

export function ProjectGantt({
  tarefas,
  onAbrir,
}: {
  tarefas: Tarefa[]
  /** Clicar numa tarefa abre o editor. Ausente em modo de leitura. */
  onAbrir?: (t: Tarefa) => void
}) {
  const [fechadas, setFechadas] = useState<Set<string>>(new Set())

  const { grupos, inicio, total, meses, hojePct } = useMemo(() => {
    // Agrupar preservando a ordem de chegada (a API já ordena por fase)
    const porNome = new Map<string, Tarefa[]>()
    for (const t of tarefas) {
      const nome = t.phase?.trim() || SEM_FASE
      const lista = porNome.get(nome)
      if (lista) lista.push(t)
      else porNome.set(nome, [t])
    }

    const grupos: Grupo[] = [...porNome.entries()].map(([nome, lista], i) => {
      const datas = lista
        .flatMap((t) => [t.start_date, t.end_date])
        .filter((d): d is string => Boolean(d))
        .map(aoDia)
      return {
        nome,
        cor: CORES_FASE[i % CORES_FASE.length],
        tarefas: lista,
        inicio: datas.length ? Math.min(...datas) : null,
        fim: datas.length ? Math.max(...datas) : null,
      }
    })

    const todas = grupos.flatMap((g) => (g.inicio !== null ? [g.inicio, g.fim as number] : []))
    if (todas.length === 0) {
      return { grupos, inicio: 0, total: 0, meses: [], hojePct: null }
    }

    // Alargar a escala às fronteiras do mês, para o eixo ficar com meses
    // inteiros em vez de começar a meio.
    const min = new Date(Math.min(...todas))
    const max = new Date(Math.max(...todas))
    const escInicio = new Date(min.getFullYear(), min.getMonth(), 1).getTime()
    const escFim = new Date(max.getFullYear(), max.getMonth() + 1, 0).getTime()
    const escTotal = Math.max(escFim - escInicio, DIA_MS)

    const meses: { label: string; left: number }[] = []
    const cursor = new Date(escInicio)
    while (cursor.getTime() <= escFim) {
      meses.push({
        label: `${MESES[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`,
        left: ((cursor.getTime() - escInicio) / escTotal) * 100,
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }

    const agora = Date.now()
    const hojePct =
      agora >= escInicio && agora <= escFim ? ((agora - escInicio) / escTotal) * 100 : null

    return { grupos, inicio: escInicio, total: escTotal, meses, hojePct }
  }, [tarefas])

  if (total === 0) {
    return (
      <div className="surface-card p-6 text-center">
        <p className="text-xs text-muted-foreground">
          As tarefas ainda não têm datas, por isso não há cronograma para mostrar.
        </p>
      </div>
    )
  }

  /** Posição e largura de uma barra, em % da escala. */
  function barra(de: number | null, ate: number | null) {
    if (de === null) return null
    const fim = ate ?? de
    return {
      left: `${((de - inicio) / total) * 100}%`,
      // mínimo visível: uma tarefa de um dia não pode desaparecer
      width: `${Math.max(((fim - de) / total) * 100, 0.8)}%`,
    }
  }

  function alternar(nome: string) {
    setFechadas((anterior) => {
      const proximo = new Set(anterior)
      if (proximo.has(nome)) proximo.delete(nome)
      else proximo.add(nome)
      return proximo
    })
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          {/* Escala de meses */}
          <div className="flex border-b border-border/60 bg-muted/40">
            <div className="w-56 shrink-0 px-4 py-2 text-xs font-medium text-muted-foreground">
              Fases e tarefas
            </div>
            <div className="relative h-8 flex-1 pr-4">
              {meses.map((m) => (
                <div
                  key={m.label}
                  className="absolute top-0 h-8 border-l border-border/60 pl-1.5 pt-2 text-[11px] text-muted-foreground"
                  style={{ left: m.left + "%" }}
                >
                  {m.label}
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            {/* Linha de hoje, por cima de todas as barras */}
            {hojePct !== null && (
              <div
                className="pointer-events-none absolute inset-y-0 z-20 w-px bg-destructive/70"
                style={{ left: `calc(14rem + (100% - 14rem - 1rem) * ${hojePct / 100})` }}
              >
                <span className="absolute -top-0.5 left-1 rounded bg-destructive px-1 text-[10px] font-medium text-white">
                  hoje
                </span>
              </div>
            )}

            {grupos.map((g) => {
              const fechada = fechadas.has(g.nome)
              const resumo = barra(g.inicio, g.fim)

              return (
                <div key={g.nome} className="border-b border-border/40 last:border-b-0">
                  {/* Linha da fase */}
                  <button
                    type="button"
                    onClick={() => alternar(g.nome)}
                    aria-expanded={!fechada}
                    className="flex w-full items-center text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="flex w-56 shrink-0 items-center gap-1.5 px-3 py-2">
                      {fechada ? (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: `hsl(${g.cor})` }}
                      />
                      <span className="truncate text-xs font-semibold" title={g.nome}>
                        {g.nome}
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                        {g.tarefas.length}
                      </span>
                    </div>
                    <div className="relative h-9 flex-1 pr-4">
                      {resumo && (
                        <div
                          className="absolute top-2.5 h-4 rounded"
                          style={{
                            ...resumo,
                            backgroundColor: `hsl(${g.cor} / 0.9)`,
                          }}
                          title={`${formatDate(new Date(g.inicio!).toISOString())} - ${formatDate(
                            new Date(g.fim!).toISOString(),
                          )}`}
                        />
                      )}
                    </div>
                  </button>

                  {/* Tarefas da fase */}
                  {!fechada &&
                    g.tarefas.map((t) => {
                      const ini = t.start_date ? aoDia(t.start_date) : null
                      const fim = t.end_date ? aoDia(t.end_date) : null
                      const b = barra(ini, fim)
                      const clicavel = Boolean(onAbrir)

                      return (
                        <div
                          key={t.id}
                          role={clicavel ? "button" : undefined}
                          tabIndex={clicavel ? 0 : undefined}
                          onClick={clicavel ? () => onAbrir?.(t) : undefined}
                          onKeyDown={
                            clicavel
                              ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    onAbrir?.(t)
                                  }
                                }
                              : undefined
                          }
                          className={cn(
                            "flex items-center",
                            clicavel && "cursor-pointer hover:bg-muted/30",
                          )}
                        >
                          <div className="w-56 shrink-0 truncate py-1.5 pl-9 pr-3 text-xs text-muted-foreground">
                            {t.title}
                          </div>
                          <div className="relative h-7 flex-1 pr-4">
                            {b && (
                              <div
                                className={cn(
                                  "absolute top-2 h-3 rounded-sm",
                                  t.status === "concluida" && "opacity-60",
                                  t.status === "bloqueada" &&
                                    "ring-1 ring-inset ring-destructive",
                                )}
                                style={{
                                  ...b,
                                  backgroundColor: `hsl(${g.cor} / ${
                                    t.status === "por_iniciar" ? 0.35 : 0.65
                                  })`,
                                }}
                                title={`${t.title}\n${
                                  t.start_date ? formatDate(t.start_date) : "sem início"
                                } - ${t.end_date ? formatDate(t.end_date) : "sem fim"}\n${
                                  STATUS_LABELS[t.status]
                                }`}
                              />
                            )}
                          </div>
                        </div>
                      )
                    })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legenda: as barras distinguem-se por opacidade, o que sem legenda não
          seria adivinhável. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-foreground/35" /> Por iniciar
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-foreground/65" /> Em curso
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-foreground/40" /> Concluída
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm ring-1 ring-inset ring-destructive" /> Bloqueada
        </span>
      </div>
    </div>
  )
}
