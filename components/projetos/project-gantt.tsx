"use client"

/**
 * Gantt do planeamento, com três níveis: fase > tarefa macro > subtarefa.
 *
 * A fase é um agrupamento por nome (project_tasks.phase) e não tem linha
 * própria na base de dados: a barra dela é calculada a partir das tarefas que
 * contém. Os outros dois níveis são linhas reais, ligadas por parent_id.
 *
 * A escala é em pixéis por dia (não em percentagem), como nas ferramentas de
 * gestão de projeto: assim a largura de um dia é a mesma em todo o cronograma,
 * a grelha alinha com as barras e cronogramas longos fazem scroll em vez de
 * comprimir. A coluna dos nomes é sticky para não se perder o contexto.
 */

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/portugal"
import type { Tarefa } from "@/components/projetos/project-plan-tab"

const DIA_MS = 86_400_000
/** Largura da coluna dos nomes, em px. Usada também no offset da grelha. */
const COL_NOMES = 256

/** Cores das fases. Ciclam se houver mais fases do que cores. */
const CORES_FASE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const

const SEM_FASE = "Sem fase"

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]
const MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

type Zoom = "dia" | "semana" | "mes"

const PX_POR_DIA: Record<Zoom, number> = { dia: 34, semana: 13, mes: 4.2 }

const ZOOM_LABELS: Record<Zoom, string> = { dia: "Dia", semana: "Semana", mes: "Mês" }

/** Meia-noite local do dia (as datas vêm em YYYY-MM-DD, sem fuso). */
function aoDia(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number)
  return new Date(a, m - 1, d).getTime()
}

function inicioDoDia(t: number): number {
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

type Nodo = { tarefa: Tarefa; filhos: Tarefa[] }
type Grupo = { nome: string; cor: string; nodos: Nodo[]; inicio: number | null; fim: number | null }

/** Linha desenhada no Gantt. A fase não existe na base de dados, é agregação. */
type Linha =
  | { tipo: "fase"; chave: string; grupo: Grupo }
  | { tipo: "macro"; chave: string; grupo: Grupo; tarefa: Tarefa; temFilhos: boolean }
  | { tipo: "sub"; chave: string; grupo: Grupo; tarefa: Tarefa }

const ALTURA: Record<Linha["tipo"], number> = { fase: 38, macro: 32, sub: 28 }

function extremos(tarefas: Tarefa[]): { inicio: number | null; fim: number | null } {
  const datas = tarefas
    .flatMap((t) => [t.start_date, t.end_date])
    .filter((d): d is string => Boolean(d))
    .map(aoDia)
  return datas.length
    ? { inicio: Math.min(...datas), fim: Math.max(...datas) }
    : { inicio: null, fim: null }
}

export function ProjectGantt({
  tarefas,
  onAbrir,
}: {
  tarefas: Tarefa[]
  /** Clicar numa tarefa abre o editor. Ausente em modo de leitura. */
  onAbrir?: (t: Tarefa) => void
}) {
  const [fechados, setFechados] = useState<Set<string>>(new Set())
  const [zoomManual, setZoomManual] = useState<Zoom | null>(null)

  const { grupos, escInicio, escFim, dias } = useMemo(() => {
    // Árvore: as subtarefas ficam debaixo da macro, pela ordem que a API deu
    const filhosPorPai = new Map<string, Tarefa[]>()
    for (const t of tarefas) {
      if (!t.parent_id) continue
      const lista = filhosPorPai.get(t.parent_id)
      if (lista) lista.push(t)
      else filhosPorPai.set(t.parent_id, [t])
    }

    // Agrupar as macro por fase, preservando a ordem de chegada
    const porFase = new Map<string, Nodo[]>()
    for (const t of tarefas) {
      if (t.parent_id) continue
      const nome = t.phase?.trim() || SEM_FASE
      const nodo: Nodo = { tarefa: t, filhos: filhosPorPai.get(t.id) ?? [] }
      const lista = porFase.get(nome)
      if (lista) lista.push(nodo)
      else porFase.set(nome, [nodo])
    }

    const grupos: Grupo[] = [...porFase.entries()].map(([nome, nodos], i) => {
      // A barra da fase cobre também as subtarefas: uma subtarefa que estoire o
      // período da macro tem de ser visível no resumo.
      const todas = nodos.flatMap((n) => [n.tarefa, ...n.filhos])
      return { nome, cor: CORES_FASE[i % CORES_FASE.length], nodos, ...extremos(todas) }
    })

    const limites = grupos.flatMap((g) => (g.inicio !== null ? [g.inicio, g.fim as number] : []))
    if (limites.length === 0) {
      return { grupos, escInicio: 0, escFim: 0, dias: 0 }
    }

    // Uma semana de folga de cada lado, para as barras não colarem às bordas
    const escInicio = Math.min(...limites) - 3 * DIA_MS
    const escFim = Math.max(...limites) + 4 * DIA_MS
    return { grupos, escInicio, escFim, dias: Math.round((escFim - escInicio) / DIA_MS) + 1 }
  }, [tarefas])

  // Escala automática pela duração, com hipótese de o utilizador forçar outra
  const zoom: Zoom = zoomManual ?? (dias <= 45 ? "dia" : dias <= 260 ? "semana" : "mes")
  const pxDia = PX_POR_DIA[zoom]
  const larguraTotal = Math.max(dias * pxDia, 320)

  const { colunas, cabecalhos } = useMemo(() => {
    if (dias === 0) return { colunas: [], cabecalhos: [] }

    const colunas: { chave: string; left: number; largura: number; label: string; fds: boolean }[] = []
    const cabecalhos: { chave: string; left: number; largura: number; label: string }[] = []

    const px = (t: number) => ((t - escInicio) / DIA_MS) * pxDia

    if (zoom === "mes") {
      // Colunas = meses; cabeçalho = anos
      const c = new Date(escInicio)
      c.setDate(1)
      while (c.getTime() <= escFim) {
        const proximo = new Date(c.getFullYear(), c.getMonth() + 1, 1).getTime()
        colunas.push({
          chave: `m${c.getFullYear()}-${c.getMonth()}`,
          left: px(c.getTime()),
          largura: px(proximo) - px(c.getTime()),
          label: MESES_CURTO[c.getMonth()],
          fds: false,
        })
        c.setMonth(c.getMonth() + 1)
      }
      const a = new Date(escInicio)
      a.setMonth(0, 1)
      while (a.getTime() <= escFim) {
        const proximo = new Date(a.getFullYear() + 1, 0, 1).getTime()
        cabecalhos.push({
          chave: `a${a.getFullYear()}`,
          left: px(a.getTime()),
          largura: px(proximo) - px(a.getTime()),
          label: String(a.getFullYear()),
        })
        a.setFullYear(a.getFullYear() + 1)
      }
    } else {
      // Colunas = dias (zoom dia) ou semanas (zoom semana); cabeçalho = meses
      const passo = zoom === "dia" ? 1 : 7
      const c = new Date(escInicio)
      if (zoom === "semana") {
        // Alinhar as semanas a segunda-feira, senão os rótulos saem a meio
        const desvio = (c.getDay() + 6) % 7
        c.setDate(c.getDate() - desvio)
      }
      while (c.getTime() <= escFim) {
        const proximo = new Date(c.getFullYear(), c.getMonth(), c.getDate() + passo).getTime()
        const diaSemana = c.getDay()
        colunas.push({
          chave: `d${c.getTime()}`,
          left: px(c.getTime()),
          largura: px(proximo) - px(c.getTime()),
          label:
            zoom === "dia"
              ? String(c.getDate())
              : `${c.getDate()}/${String(c.getMonth() + 1).padStart(2, "0")}`,
          fds: zoom === "dia" && (diaSemana === 0 || diaSemana === 6),
        })
        c.setDate(c.getDate() + passo)
      }

      const m = new Date(escInicio)
      m.setDate(1)
      while (m.getTime() <= escFim) {
        const proximo = new Date(m.getFullYear(), m.getMonth() + 1, 1).getTime()
        cabecalhos.push({
          chave: `M${m.getFullYear()}-${m.getMonth()}`,
          left: px(m.getTime()),
          largura: px(proximo) - px(m.getTime()),
          label: `${MESES[m.getMonth()]} ${m.getFullYear()}`,
        })
        m.setMonth(m.getMonth() + 1)
      }
    }

    return { colunas, cabecalhos }
  }, [dias, escInicio, escFim, pxDia, zoom])

  // Linhas visíveis, já com os grupos fechados por fora
  const linhas = useMemo(() => {
    const out: Linha[] = []
    for (const g of grupos) {
      out.push({ tipo: "fase", chave: `f:${g.nome}`, grupo: g })
      if (fechados.has(`f:${g.nome}`)) continue
      for (const n of g.nodos) {
        out.push({
          tipo: "macro",
          chave: `t:${n.tarefa.id}`,
          grupo: g,
          tarefa: n.tarefa,
          temFilhos: n.filhos.length > 0,
        })
        if (fechados.has(`t:${n.tarefa.id}`)) continue
        for (const f of n.filhos) {
          out.push({ tipo: "sub", chave: `t:${f.id}`, grupo: g, tarefa: f })
        }
      }
    }
    return out
  }, [grupos, fechados])

  if (dias === 0) {
    return (
      <div className="surface-card p-6 text-center">
        <p className="text-xs text-muted-foreground">
          As tarefas ainda não têm datas, por isso não há cronograma para mostrar.
        </p>
      </div>
    )
  }

  const alturaCorpo = linhas.reduce((s, l) => s + ALTURA[l.tipo], 0)
  const hoje = inicioDoDia(Date.now())
  const hojeLeft =
    hoje >= escInicio && hoje <= escFim ? ((hoje - escInicio) / DIA_MS) * pxDia : null

  function alternar(chave: string) {
    setFechados((anterior) => {
      const proximo = new Set(anterior)
      if (proximo.has(chave)) proximo.delete(chave)
      else proximo.add(chave)
      return proximo
    })
  }

  /** Geometria de uma barra em px. null quando a tarefa não tem início. */
  function barra(de: number | null, ate: number | null) {
    if (de === null) return null
    const fim = ate ?? de
    // Fim inclusivo: uma tarefa que acaba no dia 5 ocupa o dia 5 inteiro
    const left = ((de - escInicio) / DIA_MS) * pxDia
    return {
      left,
      largura: Math.max(((fim - de) / DIA_MS + 1) * pxDia, 6),
      marco: fim === de,
    }
  }

  return (
    <div className="surface-card overflow-hidden">
      {/* Escala */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2">
        <p className="text-xs text-muted-foreground">
          {linhas.length} linha{linhas.length !== 1 ? "s" : ""} visíve
          {linhas.length !== 1 ? "is" : "l"}
        </p>
        <div className="inline-flex gap-1 rounded-lg border border-border/60 bg-muted p-0.5">
          {(Object.keys(ZOOM_LABELS) as Zoom[]).map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoomManual(z)}
              aria-current={zoom === z ? "true" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                zoom === z
                  ? "bg-card text-foreground shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.08))]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {ZOOM_LABELS[z]}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ width: COL_NOMES + larguraTotal }}>
          {/* Cabeçalho: mês/ano por cima, dia/semana/mês por baixo */}
          <div className="sticky top-0 z-30 border-b border-border/60 bg-muted/50">
            <div className="flex">
              <div
                className="sticky left-0 z-10 shrink-0 border-r border-border/60 bg-muted/50 px-4 py-1.5 text-xs font-semibold"
                style={{ width: COL_NOMES }}
              >
                Fases e tarefas
              </div>
              <div className="relative h-6" style={{ width: larguraTotal }}>
                {cabecalhos.map((c) => (
                  <div
                    key={c.chave}
                    className="absolute top-0 h-6 overflow-hidden whitespace-nowrap border-l border-border/60 px-1.5 py-1 text-[11px] font-medium capitalize text-muted-foreground"
                    style={{ left: c.left, width: c.largura }}
                  >
                    {c.label}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex">
              <div
                className="sticky left-0 z-10 shrink-0 border-r border-border/60 bg-muted/50"
                style={{ width: COL_NOMES }}
              />
              <div className="relative h-5" style={{ width: larguraTotal }}>
                {colunas.map((c) => (
                  <div
                    key={c.chave}
                    className={cn(
                      "absolute top-0 h-5 overflow-hidden text-center text-[10px] leading-5 text-muted-foreground",
                      c.fds && "bg-muted",
                    )}
                    style={{ left: c.left, width: c.largura }}
                  >
                    {c.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Corpo */}
          <div className="relative" style={{ minHeight: alturaCorpo }}>
            {/* Fundo: fins de semana, linhas de grelha e o dia de hoje. Uma só
                camada para todas as linhas, senão o alinhamento vertical
                dependia da altura de cada uma. */}
            <div
              className="pointer-events-none absolute inset-y-0 z-0"
              style={{ left: COL_NOMES, width: larguraTotal }}
            >
              {colunas.map((c) => (
                <div
                  key={c.chave}
                  className={cn("absolute inset-y-0 border-l border-border/40", c.fds && "bg-muted/50")}
                  style={{ left: c.left, width: c.largura }}
                />
              ))}
              {hojeLeft !== null && (
                <div className="absolute inset-y-0 w-px bg-destructive/60" style={{ left: hojeLeft }} />
              )}
            </div>

            {linhas.map((l) => {
              const g = l.grupo
              const ehFase = l.tipo === "fase"
              const t = ehFase ? null : l.tarefa
              const b = ehFase ? barra(g.inicio, g.fim) : barra(
                t!.start_date ? aoDia(t!.start_date) : null,
                t!.end_date ? aoDia(t!.end_date) : null,
              )
              const fechado = fechados.has(l.chave)
              const colapsavel = ehFase || (l.tipo === "macro" && l.temFilhos)
              const progresso = ehFase ? progressoDaFase(g) : t!.progress

              return (
                <div
                  key={l.chave}
                  className={cn(
                    "relative z-10 flex",
                    ehFase && "bg-muted/40",
                    !ehFase && onAbrir && "hover:bg-muted/30",
                  )}
                  style={{ height: ALTURA[l.tipo] }}
                >
                  {/* Nome */}
                  <div
                    className={cn(
                      "sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-r border-border/60 pr-3",
                      ehFase ? "bg-muted/95 pl-2" : "bg-card",
                      l.tipo === "macro" && "pl-7",
                      l.tipo === "sub" && "pl-12",
                    )}
                    style={{ width: COL_NOMES }}
                  >
                    {colapsavel ? (
                      <button
                        type="button"
                        onClick={() => alternar(l.chave)}
                        aria-expanded={!fechado}
                        aria-label={fechado ? "Expandir" : "Colapsar"}
                        className="shrink-0 rounded text-muted-foreground hover:text-foreground"
                      >
                        {fechado ? (
                          <ChevronRight className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ) : (
                      l.tipo !== "sub" && <span className="w-3.5 shrink-0" />
                    )}

                    {ehFase && (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: `hsl(${g.cor})` }}
                      />
                    )}

                    <button
                      type="button"
                      onClick={
                        ehFase ? () => alternar(l.chave) : onAbrir ? () => onAbrir(t!) : undefined
                      }
                      disabled={!ehFase && !onAbrir}
                      title={ehFase ? g.nome : t!.title}
                      className={cn(
                        "min-w-0 flex-1 truncate text-left",
                        ehFase && "text-xs font-semibold",
                        l.tipo === "macro" && "text-xs font-medium",
                        l.tipo === "sub" && "text-xs text-muted-foreground",
                        !ehFase && onAbrir && "hover:underline",
                      )}
                    >
                      {ehFase ? g.nome : t!.title}
                    </button>

                    {ehFase && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {g.nodos.length}
                      </span>
                    )}
                  </div>

                  {/* Barra */}
                  <div className="relative shrink-0" style={{ width: larguraTotal }}>
                    {b &&
                      (b.marco ? (
                        // Tarefa de um só dia: losango, como um marco
                        <span
                          className="absolute rotate-45 rounded-[2px]"
                          style={{
                            left: b.left + b.largura / 2 - 6,
                            top: ALTURA[l.tipo] / 2 - 6,
                            width: 12,
                            height: 12,
                            backgroundColor: `hsl(${g.cor})`,
                          }}
                          title={rotulo(ehFase ? g.nome : t!.title, t)}
                        />
                      ) : (
                        <div
                          className={cn(
                            "absolute overflow-hidden",
                            ehFase ? "rounded-sm" : "rounded",
                            !ehFase && t!.status === "bloqueada" && "ring-1 ring-destructive",
                          )}
                          style={{
                            left: b.left,
                            width: b.largura,
                            top: ALTURA[l.tipo] / 2 - (ehFase ? 6 : l.tipo === "macro" ? 8 : 6),
                            height: ehFase ? 12 : l.tipo === "macro" ? 16 : 12,
                            backgroundColor: `hsl(${g.cor} / ${ehFase ? 0.3 : 0.22})`,
                          }}
                          title={rotulo(ehFase ? g.nome : t!.title, t)}
                        >
                          {/* Preenchimento = progresso. A 0% fica só o contorno,
                              que é o que distingue "por fazer" de "a meio". */}
                          <div
                            className="h-full"
                            style={{
                              width: `${Math.max(progresso, 0)}%`,
                              backgroundColor: `hsl(${g.cor} / ${ehFase ? 1 : 0.85})`,
                            }}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
        <span>A parte cheia da barra é o progresso.</span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rotate-45 rounded-[2px] bg-foreground/50" /> Marco (um dia)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded ring-1 ring-destructive" /> Bloqueada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-px bg-destructive/60" /> Hoje
        </span>
      </div>
    </div>
  )
}

/** Progresso da fase = média do progresso das tarefas macro que a compõem. */
function progressoDaFase(g: Grupo): number {
  if (g.nodos.length === 0) return 0
  const soma = g.nodos.reduce((s, n) => s + (n.tarefa.progress ?? 0), 0)
  return Math.round(soma / g.nodos.length)
}

function rotulo(titulo: string, t: Tarefa | null): string {
  if (!t) return titulo
  const de = t.start_date ? formatDate(t.start_date) : "sem início"
  const ate = t.end_date ? formatDate(t.end_date) : "sem fim"
  return `${titulo}\n${de} - ${ate}\n${t.progress ?? 0}% concluído`
}
