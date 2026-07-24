"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/portugal"

type Existing = {
  id: string
  url: string
  has_secret: boolean
  is_active: boolean
  last_sync_at: string | null
  sync_error: string | null
}

export function ErpIntegrationCard({
  initial,
  canEdit,
}: {
  initial: Existing | null
  canEdit: boolean
}) {
  const router = useRouter()
  const [url, setUrl] = useState(initial?.url ?? "")
  const [secret, setSecret] = useState("")
  const [showForm, setShowForm] = useState(!initial)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [importingHistory, setImportingHistory] = useState(false)

  async function handleTest() {
    if (!url || !secret) {
      toast.error("URL e secret obrigatórios para testar")
      return
    }
    setTesting(true)
    try {
      const res = await fetch("/api/integracoes/erp/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, secret }),
      })
      const body = await res.json()
      if (res.ok && body.ok) {
        toast.success(`Webhook respondeu ${body.status ?? 200} ✓`, {
          description: "Verifica no teu n8n a recepção do payload de teste.",
        })
      } else {
        toast.error("Webhook falhou", {
          description: `${body.status ? `HTTP ${body.status} · ` : ""}${body.error ?? ""}`.slice(
            0,
            400,
          ),
          duration: 12000,
        })
      }
    } catch (e) {
      toast.error("Erro a contactar o servidor", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    if (!url) {
      toast.error("URL obrigatório")
      return
    }
    if (!initial && !secret) {
      toast.error("Secret obrigatório na primeira ligação")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/integracoes/erp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url,
          ...(secret ? { secret } : {}),
        }),
      })
      const body = await res.json()
      if (res.ok && body.ok) {
        toast.success(initial ? "Integração atualizada" : "Integração ligada")
        setSecret("")
        setShowForm(false)
        router.refresh()
      } else {
        toast.error("Falha ao guardar", {
          description: body.error ?? `HTTP ${res.status}`,
        })
      }
    } catch (e) {
      toast.error("Erro a contactar o servidor", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleSyncToconline() {
    setSyncing(true)
    try {
      const now = new Date()
      const res = await fetch("/api/faturas/sync-toconline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          type: "both",
        }),
      })
      const body = await res.json()
      if (res.ok) {
        toast.success(`Sync TOCONLINE concluído`, {
          description: `${body.created ?? 0} criadas · ${body.updated ?? 0} actualizadas${body.errors?.length ? ` · ${body.errors.length} erros` : ""}`,
        })
        router.refresh()
      } else {
        toast.error("Sync falhou", {
          description: body.error ?? `HTTP ${res.status}`,
        })
      }
    } catch (e) {
      toast.error("Erro de rede", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSyncing(false)
    }
  }

  async function handleImportHistory() {
    if (
      !confirm(
        "Importar o histórico de receita e gastos do TOConline (jan/2025 ao mês atual)?\n\nBusca as vendas e compras via n8n e recalcula os totais mensais. Pode demorar até um minuto.",
      )
    ) {
      return
    }
    setImportingHistory(true)
    try {
      const res = await fetch("/api/integracoes/toconline/import-historico", { method: "POST" })
      const body = await res.json()
      if (res.ok && body.ok) {
        if (body.errors?.length) {
          toast.warning("Histórico importado com erros", {
            description: `${body.months_processed} meses ok, ${body.errors.length} erros: ${body.errors.slice(0, 2).join(" | ")}`,
            duration: 15000,
          })
        } else {
          toast.success("Histórico importado", {
            description: `${body.months_processed} meses processados`,
          })
        }
        router.refresh()
      } else {
        toast.error("Falha na importação", { description: body.error ?? `HTTP ${res.status}` })
      }
    } catch (e) {
      toast.error("Erro de rede", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setImportingHistory(false)
    }
  }

  async function handleRemove() {
    if (
      !confirm(
        "Desligar a integração ERP? Faturas novas deixarão de ser enviadas automaticamente.",
      )
    ) {
      return
    }
    setRemoving(true)
    try {
      const res = await fetch("/api/integracoes/erp", { method: "DELETE" })
      const body = await res.json()
      if (res.ok && body.ok) {
        toast.success("Integração desligada")
        router.refresh()
      } else {
        toast.error("Falha ao remover", {
          description: body.error ?? `HTTP ${res.status}`,
        })
      }
    } catch (e) {
      toast.error("Erro a contactar o servidor", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setRemoving(false)
    }
  }

  const status = initial?.is_active
    ? initial.sync_error
      ? "error"
      : "connected"
    : initial
      ? "disconnected"
      : "soon"

  return (
    <Card className={cn(status === "error" && "border-destructive/40")}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">ERP (via n8n)</p>
              <p className="text-xs text-muted-foreground">
                Quando uma fatura é processada, enviamos um POST assinado
                (HMAC-SHA256) ao teu webhook n8n com os dados + signed URL
                do ficheiro.
              </p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {initial && status !== "soon" && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p className="font-mono truncate">{initial.url}</p>
            {initial.last_sync_at && (
              <p>Último envio com sucesso: {formatDate(initial.last_sync_at)}</p>
            )}
            {initial.sync_error && (
              <p className="text-destructive break-all">{initial.sync_error}</p>
            )}
          </div>
        )}

        {canEdit && showForm && (
          <div className="space-y-3 pt-2 border-t">
            <div className="space-y-1.5">
              <Label htmlFor="erp-url">Webhook URL</Label>
              <Input
                id="erp-url"
                type="url"
                placeholder="https://n8n.exemplo.pt/webhook/isoflow"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="erp-secret">
                Secret HMAC
                {initial?.has_secret && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (deixa em branco para manter o actual)
                  </span>
                )}
              </Label>
              <Input
                id="erp-secret"
                type="password"
                placeholder={initial?.has_secret ? "•••••••• (atual)" : "Secret partilhado com o n8n"}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                O n8n recebe header{" "}
                <code className="text-[10px]">X-ISOFlow-Signature</code> com
                HMAC-SHA256 do body. Valida-o lá para garantir autenticidade.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              {initial && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowForm(false)
                    setSecret("")
                  }}
                >
                  Cancelar
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing || !url || !secret}
              >
                {testing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Enviar payload de teste
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={saving || !url}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {initial ? "Guardar alterações" : "Ligar"}
              </Button>
            </div>
          </div>
        )}

        {!showForm && canEdit && (
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={removing}
            >
              {removing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Desligar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(true)}
            >
              Editar
            </Button>
            {initial?.is_active && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncToconline}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sincronizar TOCONLINE
              </Button>
            )}
            {initial?.is_active && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleImportHistory}
                disabled={importingHistory}
              >
                {importingHistory ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Importar histórico
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatusBadge({
  status,
}: {
  status: "connected" | "disconnected" | "error" | "soon"
}) {
  const map = {
    connected: {
      label: "Ligado",
      dot: "bg-emerald-500",
      className:
        "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40",
    },
    disconnected: {
      label: "Desligado",
      dot: "bg-muted-foreground",
      className: "",
    },
    error: {
      label: "Erro",
      dot: "bg-destructive",
      className:
        "bg-red-100 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-900/40",
    },
    soon: {
      label: "Pronto a ligar",
      dot: "bg-blue-500",
      className:
        "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-900/40",
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
