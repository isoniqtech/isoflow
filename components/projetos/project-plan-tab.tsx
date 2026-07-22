"use client"

/**
 * Tab de Planejamento do projeto.
 *
 * Sem tarefas: ecrã para gerar o cronograma com IA, por voz (Web Speech API,
 * pt-PT) ou texto. Com tarefas: timeline horizontal + CRUD.
 *
 * Investidor: leitura, e só tarefas com visibility='todos' (filtrado na API).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Mic, MicOff, Pencil, Plus, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
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
}

const STATUS_LABELS: Record<Status, string> = {
  por_iniciar: "Por iniciar",
  em_curso: "Em curso",
  concluida: "Concluída",
  bloqueada: "Bloqueada",
}

const STATUS_BAR: Record<Status, string> = {
  por_iniciar: "bg-muted-foreground/40",
  em_curso: "bg-primary",
  concluida: "bg-emerald-500",
  bloqueada: "bg-destructive",
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
  const [criar, setCriar] = useState(false)
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
      <div className="rounded-lg border border-dashed border-border/60 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Ainda não há planeamento partilhado para este projeto.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {podeEditar && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {tarefas.length} tarefa{tarefas.length !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setRegerar(true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              Voltar a gerar com IA
            </Button>
            <Button size="sm" onClick={() => setCriar(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova tarefa
            </Button>
          </div>
        </div>
      )}

      <Timeline tarefas={tarefas} />

      <div className="rounded-lg border border-border/60 bg-card divide-y">
        {tarefas.map((t) => (
          <div key={t.id} className="flex items-start gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{t.title}</p>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_BADGE[t.status])}>
                  {STATUS_LABELS[t.status]}
                </span>
                {podeEditar && t.visibility === "admin" && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    só equipa
                  </span>
                )}
              </div>
              {t.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                {t.start_date ? formatDate(t.start_date) : "sem início"}
                {" - "}
                {t.end_date ? formatDate(t.end_date) : "sem fim"}
              </p>
            </div>
            {podeEditar && (
              <Button variant="ghost" size="sm" onClick={() => setEditar(t)} title="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {(editar || criar) && (
        <DialogoTarefa
          projectId={projectId}
          tarefa={editar}
          onFechar={() => {
            setEditar(null)
            setCriar(false)
          }}
          onMudou={carregar}
        />
      )}

      {regerar && (
        <DialogoRegerar
          projectId={projectId}
          onFechar={() => setRegerar(false)}
          onGerado={carregar}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Timeline horizontal
// ---------------------------------------------------------------------------

function Timeline({ tarefas }: { tarefas: Tarefa[] }) {
  const { inicio, total, comDatas } = useMemo(() => {
    const datas = tarefas
      .flatMap((t) => [t.start_date, t.end_date])
      .filter((d): d is string => Boolean(d))
      .map((d) => new Date(d).getTime())

    if (datas.length === 0) return { inicio: 0, total: 0, comDatas: false }
    const min = Math.min(...datas)
    const max = Math.max(...datas)
    return { inicio: min, total: Math.max(max - min, 86_400_000), comDatas: true }
  }, [tarefas])

  if (!comDatas) {
    return (
      <div className="rounded-lg border border-border/60 bg-card p-6 text-center">
        <p className="text-xs text-muted-foreground">
          As tarefas ainda não têm datas, por isso não há cronograma para mostrar.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4 overflow-x-auto">
      <div className="min-w-[520px] space-y-2">
        {tarefas.map((t) => {
          const ini = t.start_date ? new Date(t.start_date).getTime() : null
          const fim = t.end_date ? new Date(t.end_date).getTime() : ini
          const temBarra = ini !== null && fim !== null
          const left = temBarra ? ((ini! - inicio) / total) * 100 : 0
          // largura mínima para tarefas de 1 dia continuarem visíveis
          const width = temBarra ? Math.max(((fim! - ini!) / total) * 100, 1.5) : 0

          return (
            <div key={t.id} className="flex items-center gap-3">
              <div className="w-40 shrink-0 truncate text-xs" title={t.title}>
                {t.title}
              </div>
              <div className="relative h-5 flex-1 rounded bg-muted/50">
                {temBarra && (
                  <div
                    className={cn("absolute top-0 h-5 rounded", STATUS_BAR[t.status])}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${t.start_date ?? ""} - ${t.end_date ?? ""}`}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Geração com IA (voz + texto)
// ---------------------------------------------------------------------------

/** Reconhecimento de voz do browser. Ausente no Firefox, daí o fallback. */
function useVoz(onTexto: (t: string) => void) {
  const [ativo, setAtivo] = useState(false)
  const [suportado, setSuportado] = useState(false)
  const ref = useRef<unknown>(null)

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    setSuportado(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition))
  }, [])

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
      ;(ref.current as { stop: () => void } | null)?.stop()
      setAtivo(false)
      return
    }

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
    rec.onerror = () => setAtivo(false)
    rec.onend = () => setAtivo(false)
    rec.start()
    ref.current = rec
    setAtivo(true)
  }

  return { ativo, suportado, alternar }
}

function CampoDescricao({
  valor,
  setValor,
  placeholder,
}: {
  valor: string
  setValor: (v: string) => void
  placeholder: string
}) {
  const { ativo, suportado, alternar } = useVoz((t) =>
    setValor(valor ? `${valor} ${t}` : t),
  )

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

  async function gerar() {
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
        toast.success(`${body.tarefas?.length ?? 0} tarefas criadas`)
        onGerado()
      } else {
        toast.error("Não foi possível gerar", {
          description: body.error ?? `HTTP ${res.status}`,
          duration: 12000,
        })
      }
    } finally {
      setAGerar(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="text-center">
          <Sparkles className="h-8 w-8 text-primary mx-auto mb-2" />
          <h2 className="text-lg font-display font-semibold tracking-tight">
            Fazer o planejamento com inteligência artificial
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl mx-auto">
            Descreve a obra ou o projeto por palavras tuas, por voz ou por escrito, e a IA
            propõe um cronograma de tarefas. Podes ajustar tudo depois.
          </p>
        </div>

        <CampoDescricao
          valor={texto}
          setValor={setTexto}
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
      </CardContent>
    </Card>
  )
}

function DialogoRegerar({
  projectId,
  onFechar,
  onGerado,
}: {
  projectId: string
  onFechar: () => void
  onGerado: () => void
}) {
  const [texto, setTexto] = useState("")
  const [substituir, setSubstituir] = useState("substituir")
  const [aGerar, setAGerar] = useState(false)

  async function gerar() {
    if (texto.trim().length < 3) return toast.error("Descreve o que queres planear")
    setAGerar(true)
    try {
      const res = await fetch(`/api/projetos/${projectId}/tarefas/gerar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          descricao: texto.trim(),
          substituir: substituir === "substituir",
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(`${body.tarefas?.length ?? 0} tarefas criadas`)
        onGerado()
        onFechar()
      } else {
        toast.error("Não foi possível gerar", {
          description: body.error ?? `HTTP ${res.status}`,
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
          <DialogTitle>Voltar a gerar com IA</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <CampoDescricao
            valor={texto}
            setValor={setTexto}
            placeholder="Descreve o cronograma que pretendes..."
          />
          <div className="space-y-1.5">
            <Label>O que fazer às tarefas atuais</Label>
            <Select value={substituir} onValueChange={setSubstituir}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="substituir">Substituir todas</SelectItem>
                <SelectItem value="acrescentar">Acrescentar às existentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar} disabled={aGerar}>
            Cancelar
          </Button>
          <Button onClick={gerar} disabled={aGerar}>
            {aGerar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gerar
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
  onFechar,
  onMudou,
}: {
  projectId: string
  tarefa: Tarefa | null
  onFechar: () => void
  onMudou: () => void
}) {
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
        toast.error("Falha ao gravar", { description: body.error ?? `HTTP ${res.status}` })
      }
    } finally {
      setAGravar(false)
    }
  }

  async function apagar() {
    if (!tarefa) return
    if (!confirm(`Apagar a tarefa "${tarefa.title}"?`)) return
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
