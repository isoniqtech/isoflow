"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Bot, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ANTHROPIC_SUPPORTED_MODELS } from "@/lib/claude/extract-invoice"

type AiConfig = {
  configured: boolean
  has_key: boolean
  model: string | null
  is_active: boolean
  last_sync_at: string | null
  sync_error: string | null
}

export function AiIntegrationCard({
  initial,
  canEdit,
}: {
  initial: AiConfig | null
  canEdit: boolean
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(!initial?.configured)
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState(initial?.model ?? ANTHROPIC_SUPPORTED_MODELS[0].id)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function handleSave() {
    if (!apiKey) {
      toast.error("Chave API obrigatoria")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/integracoes/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, model }),
      })
      const body = await res.json()
      if (res.ok && body.ok) {
        toast.success("Chave Anthropic guardada e validada")
        setApiKey("")
        setShowForm(false)
        router.refresh()
      } else {
        toast.error("Falha ao guardar", {
          description: body.error ?? `HTTP ${res.status}`,
          duration: 10000,
        })
      }
    } catch (e) {
      toast.error("Erro de rede", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!confirm("Remover chave Anthropic? A plataforma volta a usar a chave partilhada.")) return
    setRemoving(true)
    try {
      const res = await fetch("/api/integracoes/ai", { method: "DELETE" })
      const body = await res.json()
      if (res.ok && body.ok) {
        toast.success("Chave removida - usando chave da plataforma")
        router.refresh()
      } else {
        toast.error("Falha", { description: body.error ?? `HTTP ${res.status}` })
      }
    } catch (e) {
      toast.error("Erro de rede", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setRemoving(false)
    }
  }

  const configured = initial?.configured && initial.has_key
  const status = configured ? (initial?.sync_error ? "error" : "connected") : "platform"

  return (
    <Card className={cn(status === "error" && "border-destructive/40")}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">Anthropic - Extracao IA</p>
              <p className="text-xs text-muted-foreground">
                Por defeito, usamos a chave da plataforma partilhada. Podes trazer a tua propria
                chave Anthropic para ter isolamento de rate-limit e controlo de custos.
              </p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {configured && !showForm && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>
              Modelo:{" "}
              {ANTHROPIC_SUPPORTED_MODELS.find((m) => m.id === initial.model)?.label ??
                initial.model}
            </p>
            {initial.sync_error && (
              <p className="text-destructive break-all">{initial.sync_error}</p>
            )}
          </div>
        )}

        {canEdit && showForm && (
          <div className="space-y-3 pt-2 border-t">
            <div className="space-y-1.5">
              <Label htmlFor="ai-key">
                Chave API Anthropic
                {configured && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (deixa em branco para manter a atual)
                  </span>
                )}
              </Label>
              <Input
                id="ai-key"
                type="password"
                placeholder={configured ? "•••••••• (atual)" : "sk-ant-..."}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                A chave e validada antes de ser guardada. Nunca e devolvida ao browser.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-model">Modelo</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="ai-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANTHROPIC_SUPPORTED_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              {configured && (
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              )}
              <Button size="sm" onClick={handleSave} disabled={saving || !apiKey}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {configured ? "Atualizar chave" : "Guardar e validar"}
              </Button>
            </div>
          </div>
        )}

        {!showForm && canEdit && (
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            {configured && (
              <Button variant="ghost" size="sm" onClick={handleRemove} disabled={removing}>
                {removing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Remover chave propria
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              {configured ? "Alterar" : "Configurar chave propria"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: "connected" | "platform" | "error" }) {
  const map = {
    connected: {
      label: "Chave propria",
      dot: "bg-emerald-500",
      className:
        "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40",
    },
    platform: {
      label: "Chave da plataforma",
      dot: "bg-blue-500",
      className:
        "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-900/40",
    },
    error: {
      label: "Erro",
      dot: "bg-destructive",
      className:
        "bg-red-100 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-900/40",
    },
  } as const

  const s = map[status]
  return (
    <Badge variant="outline" className={cn("shrink-0", s.className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full mr-1.5", s.dot)} />
      {s.label}
    </Badge>
  )
}
