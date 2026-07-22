"use client"

/**
 * Tab de Planeamento do projeto.
 *
 * Sem tarefas: ecrã para gerar o cronograma com IA, por voz (Web Speech API,
 * pt-PT) ou texto. Com tarefas: timeline horizontal + CRUD.
 *
 * Investidor: leitura, e só tarefas com visibility='todos' (filtrado na API).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { Loader2, Mic, MicOff, Pencil, Plus, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SectionHeader } from "@/components/ui/section-header"
import { ProjectGantt } from "@/components/projetos/project-gantt"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/portugal"

type Status = "por_iniciar" | "em_curso" | "concluida" | "bloqueada"
type Visibilidade = "admin" | "todos"

export type Tarefa = {
  id: string
  title: string
  description: string | null
  start_date: string | null
  end_date: string | null
  status: Status
  visibility: Visibilidade
  sort_order: number
  /** Fase a que a tarefa pertence. Null nas tarefas anteriores à migration 045. */
  phase: string | null
  phase_order: number | null
  /** Tarefa macro a que pertence. Null = é ela própria uma tarefa macro. */
  parent_id: string | null
  /** 0 a 100. Desenha o preenchimento da barra no Gantt. */
  progress: number
}

const STATUS_LABELS: Record<Status, string> = {
  por_iniciar: "Por iniciar",
  em_curso: "Em curso",
  concluida: "Concluída",
  bloqueada: "Bloqueada",
}

const STATUS_BADGE: Record<Status, string> = {
  por_iniciar: "bg-muted text-muted-foreground",
  em_curso: "bg-primary/10 text-primary",
  concluida: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200",
  bloqueada: "bg-red-100 text-red-900 dark:bg-red-900/20 dark:text-red-200",
}

// ---------------------------------------------------------------------------

export function ProjectPlanTab({
  projectId,
  canEdit,
  isInvestidor,
}: {
  projectId: string
  canEdit: boolean
  isInvestidor: boolean
}) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [loading, setLoading] = useState(true)
  const [editar, setEditar] = useState<Tarefa | null>(null)
  // `criar` guarda o pai da nova tarefa: null = tarefa macro, id = subtarefa
  const [criar, setCriar] = useState<{ paiId: string | null } | null>(null)
  const [regerar, setRegerar] = useState(false)

  const podeEditar = canEdit && !isInvestidor

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/projetos/${projectId}/tarefas`)
      const body = await res.json()
      if (res.ok) setTarefas(body.tarefas ?? [])
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        A carregar planeamento...
      </div>
    )
  }

  // Estado inicial: sem tarefas
  if (tarefas.length === 0) {
    return podeEditar ? (
      <GerarComIA projectId={projectId} onGerado={carregar} />
    ) : (
      <div className="surface-empty p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Ainda não há planeamento partilhado para este projeto.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        titulo="Cronograma"
        descricao={`${tarefas.length} tarefa${tarefas.length !== 1 ? "s" : ""} no planeamento`}
        contador={podeEditar ? undefined : tarefas.length}
        accao={
          podeEditar ? (
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" onClick={() => setRegerar(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Gerar com IA
              </Button>
              <Button size="sm" onClick={() => setCriar({ paiId: null })}>
                <Plus className="mr-2 h-4 w-4" />
                Nova tarefa
              </Button>
            </div>
          ) : undefined
        }
      />

      <ProjectGantt tarefas={tarefas} onAbrir={podeEditar ? setEditar : undefined} />

      <ListaPorFase
        tarefas={tarefas}
        podeEditar={podeEditar}
        onEditar={setEditar}
        onNovaSubtarefa={(pai) => setCriar({ paiId: pai.id })}
      />

      {(editar || criar) && (
        <DialogoTarefa
          projectId={projectId}
          tarefa={editar}
          paiInicial={criar?.paiId ?? null}
          macros={tarefas.filter((t) => !t.parent_id)}
          fasesConhecidas={[
            ...new Set(tarefas.map((t) => t.phase?.trim()).filter((p): p is string => Boolean(p))),
          ]}
          onFechar={() => {
            setEditar(null)
            setCriar(null)
          }}
          onMudou={carregar}
        />
      )}

      {regerar && (
        <DialogoGerar
          projectId={projectId}
          onFechar={() => setRegerar(false)}
          onGerado={carregar}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lista de tarefas, agrupada pelas mesmas fases do Gantt
// ---------------------------------------------------------------------------

function LinhaTarefa({
  tarefa: t,
  sub,
  podeEditar,
  onEditar,
  onNovaSubtarefa,
}: {
  tarefa: Tarefa
  sub: boolean
  podeEditar: boolean
  onEditar: (t: Tarefa) => void
  onNovaSubtarefa?: () => void
}) {
  return (
    <div className={cn("flex items-start gap-3 p-3", sub && "pl-9")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("text-sm", sub ? "text-muted-foreground" : "font-medium")}>{t.title}</p>
          <span
            className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_BADGE[t.status])}
          >
            {STATUS_LABELS[t.status]}
          </span>
          {t.progress > 0 && t.status !== "concluida" && (
            <span className="text-xs text-muted-foreground">{t.progress}%</span>
          )}
          {podeEditar && t.visibility === "admin" && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              só equipa
            </span>
          )}
        </div>
        {t.description && <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t.start_date ? formatDate(t.start_date) : "sem início"}
          {" - "}
          {t.end_date ? formatDate(t.end_date) : "sem fim"}
        </p>
      </div>

      {podeEditar && (
        <div className="flex shrink-0 gap-1">
          {onNovaSubtarefa && (
            <Button variant="ghost" size="sm" onClick={onNovaSubtarefa} title="Nova subtarefa">
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onEditar(t)} title="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

function ListaPorFase({
  tarefas,
  podeEditar,
  onEditar,
  onNovaSubtarefa,
}: {
  tarefas: Tarefa[]
  podeEditar: boolean
  onEditar: (t: Tarefa) => void
  onNovaSubtarefa: (pai: Tarefa) => void
}) {
  // A API já devolve por fase e por ordem, por isso agrupar pela ordem de
  // chegada mantém o Gantt e a lista com a mesma sequência.
  const filhos = new Map<string, Tarefa[]>()
  for (const t of tarefas) {
    if (!t.parent_id) continue
    const lista = filhos.get(t.parent_id)
    if (lista) lista.push(t)
    else filhos.set(t.parent_id, [t])
  }

  const grupos = new Map<string, Tarefa[]>()
  for (const t of tarefas) {
    if (t.parent_id) continue
    const nome = t.phase?.trim() || "Sem fase"
    const lista = grupos.get(nome)
    if (lista) lista.push(t)
    else grupos.set(nome, [t])
  }

  return (
    <div className="space-y-3">
      {[...grupos.entries()].map(([nome, macros], i) => (
        <div key={nome} className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: `hsl(var(--chart-${(i % 5) + 1}))` }}
            />
            <h3 className="text-sm font-semibold">{nome}</h3>
            <span className="text-xs text-muted-foreground">
              {macros.length} tarefa{macros.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="surface-card divide-y overflow-hidden">
            {macros.map((t) => (
              <div key={t.id} className="divide-y divide-border/40">
                <LinhaTarefa
                  tarefa={t}
                  sub={false}
                  podeEditar={podeEditar}
                  onEditar={onEditar}
                  onNovaSubtarefa={podeEditar ? () => onNovaSubtarefa(t) : undefined}
                />
                {(filhos.get(t.id) ?? []).map((f) => (
                  <LinhaTarefa
                    key={f.id}
                    tarefa={f}
                    sub
                    podeEditar={podeEditar}
                    onEditar={onEditar}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Geração com IA (voz + texto)
// ---------------------------------------------------------------------------

/**
 * Mensagem de erro a mostrar no toast.
 *
 * As rotas devolvem a mensagem genérica em `error` e a real do Postgres em
 * `details`. Mostrar só `error` dava "Database error" e não dizia nada - é
 * exactamente o tipo de erro cego que custou horas noutras integrações.
 */
function detalheErro(body: { error?: string; details?: unknown }, status: number): string {
  const detalhe =
    typeof body.details === "string" ? body.details : body.details ? JSON.stringify(body.details) : ""
  const base = body.error ?? `HTTP ${status}`
  return detalhe ? `${base}: ${detalhe}` : base
}

/**
 * Resumo do que a IA gerou. A resposta traz a árvore inteira, por isso contar
 * `length` diria "24 tarefas" quando são 8 tarefas com 16 subtarefas.
 */
function resumoGerado(tarefas: Tarefa[] | undefined): string {
  const todas = tarefas ?? []
  const macros = todas.filter((t) => !t.parent_id).length
  const subs = todas.length - macros
  const base = `${macros} tarefa${macros !== 1 ? "s" : ""}`
  return subs > 0 ? `${base} e ${subs} subtarefa${subs !== 1 ? "s" : ""}` : base
}

/** Reconhecimento de voz do browser. Ausente no Firefox, daí o fallback. */
function useVoz(onTexto: (t: string) => void) {
  const [ativo, setAtivo] = useState(false)
  const [suportado, setSuportado] = useState(false)
  const ref = useRef<unknown>(null)
  // O Chrome termina o reconhecimento sozinho ao fim de uma pausa. Sem isto, o
  // utilizador tinha de voltar a carregar no botao a meio do ditado.
  const pararPedido = useRef(false)

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    setSuportado(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition))
  }, [])

  /** Idempotente: pode ser chamada sem gravação a decorrer. */
  const parar = useCallback(() => {
    pararPedido.current = true
    ;(ref.current as { stop: () => void } | null)?.stop()
    ref.current = null
    setAtivo(false)
  }, [])

  // Sair do ecrã (ou fechar o diálogo) tem de largar o microfone. Sem isto o
  // browser ficava a gravar depois de o componente desaparecer.
  useEffect(() => parar, [parar])

  function alternar() {
    const w = window as unknown as Record<string, unknown>
    const Ctor = (w.SpeechRecognition || w.webkitSpeechRecognition) as
      | (new () => {
          lang: string
          continuous: boolean
          interimResults: boolean
          start: () => void
          stop: () => void
          onresult: ((e: unknown) => void) | null
          onerror: (() => void) | null
          onend: (() => void) | null
        })
      | undefined
    if (!Ctor) return

    if (ativo) {
      parar()
      return
    }
    pararPedido.current = false

    const rec = new Ctor()
    rec.lang = "pt-PT"
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (e: unknown) => {
      const ev = e as { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number }
      let texto = ""
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        texto += ev.results[i][0].transcript
      }
      if (texto.trim()) onTexto(texto.trim())
    }
    rec.onerror = () => {
      // Parar em caso de erro (ex: permissao negada), para nao entrar em ciclo
      pararPedido.current = true
      setAtivo(false)
    }
    rec.onend = () => {
      if (pararPedido.current) {
        setAtivo(false)
        return
      }
      // Pausa natural na fala: retomar para o ditado continuar
      try {
        rec.start()
      } catch {
        setAtivo(false)
      }
    }
    rec.start()
    ref.current = rec
    setAtivo(true)
  }

  return { ativo, suportado, alternar, parar }
}

function CampoDescricao({
  valor,
  setValor,
  placeholder,
  pararRef,
}: {
  valor: string
  setValor: Dispatch<SetStateAction<string>>
  placeholder: string
  /**
   * O pai guarda aqui a função de parar, para desligar o microfone quando
   * submete. Sem isto a gravação continuava aberta depois de "Gerar cronograma".
   */
  pararRef?: MutableRefObject<(() => void) | null>
}) {
  // Forma funcional obrigatoria: o handler de voz e' criado uma unica vez e
  // ficaria preso ao `valor` desse momento, apagando o texto anterior a cada
  // nova frase.
  const { ativo, suportado, alternar, parar } = useVoz((t) =>
    setValor((anterior) => (anterior ? `${anterior} ${t}` : t)),
  )

  useEffect(() => {
    if (!pararRef) return
    pararRef.current = parar
    return () => {
      pararRef.current = null
    }
  }, [pararRef, parar])

  return (
    <div className="space-y-2">
      <Textarea
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder={placeholder}
        rows={5}
      />
      {suportado ? (
        <Button type="button" variant={ativo ? "default" : "outline"} size="sm" onClick={alternar}>
          {ativo ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
          {ativo ? "Parar de gravar" : "Ditar por voz"}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          O teu browser não suporta ditado por voz. Escreve a descrição acima.
        </p>
      )}
    </div>
  )
}

function GerarComIA({ projectId, onGerado }: { projectId: string; onGerado: () => void }) {
  const [texto, setTexto] = useState("")
  const [aGerar, setAGerar] = useState(false)
  const pararVoz = useRef<(() => void) | null>(null)

  async function gerar() {
    pararVoz.current?.()
    if (texto.trim().length < 3) return toast.error("Descreve o que queres planear")
    setAGerar(true)
    try {
      const res = await fetch(`/api/projetos/${projectId}/tarefas/gerar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ descricao: texto.trim() }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(resumoGerado(body.tarefas))
        onGerado()
      } else {
        toast.error("Não foi possível gerar", {
          description: detalheErro(body, res.status),
          duration: 12000,
        })
      }
    } finally {
      setAGerar(false)
    }
  }

  return (
    <div className="surface-card p-6 space-y-4">
        <div className="text-center">
          <Sparkles className="h-8 w-8 text-primary mx-auto mb-2" />
          <h2 className="text-lg font-display font-semibold tracking-tight">
            Fazer o planeamento com inteligência artificial
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl mx-auto">
            Descreve a obra ou o projeto por palavras tuas, por voz ou por escrito, e a IA
            propõe um cronograma de tarefas. Podes ajustar tudo depois.
          </p>
        </div>

        <CampoDescricao
          valor={texto}
          setValor={setTexto}
          pararRef={pararVoz}
          placeholder="ex: Remodelação de um T2 em Lisboa. Começa em setembro, primeiro demolições e infraestruturas, depois canalização e eletricidade, acabamentos e limpeza final. Prazo de três meses."
        />

        <div className="flex justify-center">
          <Button onClick={gerar} disabled={aGerar}>
            {aGerar ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {aGerar ? "A gerar cronograma..." : "Gerar cronograma"}
          </Button>
        </div>
    </div>
  )
}

/**
 * Acrescentar ao cronograma com IA.
 *
 * Não há hipótese de substituir: a geração só acrescenta. Um botão capaz de
 * apagar um plano ajustado à mão é um risco que não compensa, e o servidor
 * também já não aceita substituição.
 */
function DialogoGerar({
  projectId,
  onFechar,
  onGerado,
}: {
  projectId: string
  onFechar: () => void
  onGerado: () => void
}) {
  const [texto, setTexto] = useState("")
  const [aGerar, setAGerar] = useState(false)
  const pararVoz = useRef<(() => void) | null>(null)

  async function gerar() {
    pararVoz.current?.()
    if (texto.trim().length < 3) return toast.error("Descreve o que queres planear")
    setAGerar(true)
    try {
      const res = await fetch(`/api/projetos/${projectId}/tarefas/gerar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ descricao: texto.trim() }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(resumoGerado(body.tarefas))
        onGerado()
        onFechar()
      } else {
        toast.error("Não foi possível gerar", {
          description: detalheErro(body, res.status),
          duration: 12000,
        })
      }
    } finally {
      setAGerar(false)
    }
  }

  return (
    <Dialog open onOpenChange={onFechar}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar com IA</DialogTitle>
          <DialogDescription>
            O que a IA propuser é acrescentado ao cronograma atual. Nada do que já
            existe é alterado nem apagado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <CampoDescricao
            valor={texto}
            setValor={setTexto}
            pararRef={pararVoz}
            placeholder="ex: falta a fase de acabamentos - pinturas, roupeiros e limpeza final."
          />
          <p className="text-xs text-muted-foreground">
            A IA recebe as fases e as tarefas que já existem, para não repetir o que
            já está planeado. Se indicares uma fase que já existe, as tarefas novas
            entram nessa mesma fase.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar} disabled={aGerar}>
            Cancelar
          </Button>
          <Button onClick={gerar} disabled={aGerar}>
            {aGerar ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {aGerar ? "A gerar..." : "Acrescentar ao cronograma"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Criar / editar tarefa
// ---------------------------------------------------------------------------

function DialogoTarefa({
  projectId,
  tarefa,
  paiInicial,
  macros,
  fasesConhecidas,
  onFechar,
  onMudou,
}: {
  projectId: string
  tarefa: Tarefa | null
  /** Pai pré-escolhido ao criar (botão "nova subtarefa"). */
  paiInicial: string | null
  /** Tarefas macro do projeto: as únicas que podem ser mãe. */
  macros: Tarefa[]
  /** Sugestões no datalist, para reaproveitar uma fase em vez de a escrever de novo. */
  fasesConhecidas: string[]
  onFechar: () => void
  onMudou: () => void
}) {
  const [parentId, setParentId] = useState(tarefa?.parent_id ?? paiInicial ?? "")
  const [phase, setPhase] = useState(tarefa?.phase ?? "")
  const [progress, setProgress] = useState(String(tarefa?.progress ?? 0))
  const [title, setTitle] = useState(tarefa?.title ?? "")
  const [description, setDescription] = useState(tarefa?.description ?? "")
  const [startDate, setStartDate] = useState(tarefa?.start_date ?? "")
  const [endDate, setEndDate] = useState(tarefa?.end_date ?? "")
  const [status, setStatus] = useState<Status>(tarefa?.status ?? "por_iniciar")
  const [visibility, setVisibility] = useState<Visibilidade>(tarefa?.visibility ?? "todos")
  const [aGravar, setAGravar] = useState(false)
  const [aApagar, setAApagar] = useState(false)

  async function gravar() {
    if (!title.trim()) return toast.error("A tarefa precisa de um título")
    if (startDate && endDate && endDate < startDate) {
      return toast.error("A data de fim não pode ser anterior à de início")
    }

    setAGravar(true)
    const payload = {
      parent_id: parentId || null,
      // Numa subtarefa a fase é herdada do pai, por isso nem vale a pena enviá-la
      phase: parentId ? undefined : phase.trim() || null,
      progress: Math.min(Math.max(Number(progress) || 0, 0), 100),
      title: title.trim(),
      description: description.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
      status,
      visibility,
    }
    try {
      const res = await fetch(
        tarefa
          ? `/api/projetos/${projectId}/tarefas/${tarefa.id}`
          : `/api/projetos/${projectId}/tarefas`,
        {
          method: tarefa ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(tarefa ? "Tarefa atualizada" : "Tarefa criada")
        onMudou()
        onFechar()
      } else {
        toast.error("Falha ao gravar", { description: detalheErro(body, res.status) })
      }
    } finally {
      setAGravar(false)
    }
  }

  async function apagar() {
    if (!tarefa) return
    const aviso = tarefa.parent_id ? "" : "\n\nAs subtarefas dela também são apagadas."
    if (!confirm(`Apagar a tarefa "${tarefa.title}"?${aviso}`)) return
    setAApagar(true)
    try {
      const res = await fetch(`/api/projetos/${projectId}/tarefas/${tarefa.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast.success("Tarefa apagada")
        onMudou()
        onFechar()
      } else {
        const b = await res.json().catch(() => ({}))
        toast.error("Falha ao apagar", { description: b.error ?? `HTTP ${res.status}` })
      }
    } finally {
      setAApagar(false)
    }
  }

  return (
    <Dialog open onOpenChange={onFechar}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tarefa ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nível</Label>
            <Select
              value={parentId || "macro"}
              onValueChange={(v) => setParentId(v === "macro" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="macro">Tarefa (dentro de uma fase)</SelectItem>
                {/* Só as macro podem ser mãe: o cronograma tem dois níveis de
                    tarefa, não uma árvore infinita */}
                {macros
                  .filter((m) => m.id !== tarefa?.id)
                  .map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      Subtarefa de: {m.title}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {!parentId && (
            <div className="space-y-1.5">
              <Label htmlFor="t-phase">Fase</Label>
              <Input
                id="t-phase"
                list="fases-do-projeto"
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                placeholder="ex: Fase 1 - Fundações"
              />
              <datalist id="fases-do-projeto">
                {fasesConhecidas.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Agrupa a tarefa no cronograma. Deixa vazio para ficar fora das fases.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="t-title">Título</Label>
            <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Descrição</Label>
            <Textarea
              id="t-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-ini">Início</Label>
              <Input
                id="t-ini"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-fim">Fim</Label>
              <Input
                id="t-fim"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-prog">Progresso (%)</Label>
              <Input
                id="t-prog"
                type="number"
                min={0}
                max={100}
                step={5}
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Visibilidade</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as Visibilidade)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos (inclui investidores)</SelectItem>
                  <SelectItem value="admin">Só a equipa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {tarefa ? (
            <Button
              variant="ghost"
              onClick={apagar}
              disabled={aApagar || aGravar}
              className="text-destructive hover:text-destructive"
            >
              {aApagar ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Apagar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onFechar} disabled={aGravar}>
              Cancelar
            </Button>
            <Button onClick={gravar} disabled={aGravar}>
              {aGravar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
