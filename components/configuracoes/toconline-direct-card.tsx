"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  History,
  Loader2,
  Settings2,
  Trash2,
} from "lucide-react"
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
import { formatDate } from "@/lib/utils/portugal"

type DirectConfig = {
  configured: boolean
  client_id: string | null
  has_client_secret: boolean
  has_access_token: boolean
  has_refresh_token: boolean
  token_expires_at: string | null
  subdomain: string | null
  historico_importado_at: string | null
  is_active: boolean
  last_sync_at: string | null
  sync_error: string | null
}

type IntegrationMode = "n8n" | "toconline_direct"

export function ToconlineDirectCard({
  initial,
  integrationMode,
  canEdit,
}: {
  initial: DirectConfig | null
  integrationMode: IntegrationMode
  canEdit: boolean
}) {
  const router = useRouter()
  const [mode, setMode] = useState<IntegrationMode>(integrationMode)
  const [showForm, setShowForm] = useState(false)
  const [savingMode, setSavingMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [importingHistory, setImportingHistory] = useState(false)
  const [historicoImportadoAt, setHistoricoImportadoAt] = useState(
    initial?.historico_importado_at ?? null,
  )

  const [clientId, setClientId] = useState(initial?.client_id ?? "")
  const [clientSecret, setClientSecret] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [refreshToken, setRefreshToken] = useState("")
  const [subdomain, setSubdomain] = useState(initial?.subdomain ?? "")

  async function handleImportHistory() {
    if (
      !confirm(
        "Importar receita e gastos de Jan/2025 ao mes atual?\n\nIsso substitui os valores ja existentes. Pode demorar ate 2 minutos.",
      )
    )
      return
    setImportingHistory(true)
    try {
      const res = await fetch("/api/integracoes/toconline/import-historico", { method: "POST" })
      const body = await res.json()
      if (res.ok && body.ok) {
        setHistoricoImportadoAt(body.imported_at)
        toast.success("Historico importado", {
          description: `${body.months_processed} meses processados${body.errors?.length ? ` - ${body.errors.length} erros` : ""}`,
        })
        router.refresh()
      } else {
        toast.error("Falha na importacao", { description: body.error ?? `HTTP ${res.status}` })
      }
    } catch (e) {
      toast.error("Erro de rede", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setImportingHistory(false)
    }
  }

  async function handleModeChange(newMode: IntegrationMode) {
    if (newMode === mode) return
    setSavingMode(true)
    try {
      const res = await fetch("/api/integracoes/erp/mode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: newMode }),
      })
      const body = await res.json()
      if (res.ok && body.ok) {
        setMode(newMode)
        toast.success(
          newMode === "toconline_direct"
            ? "Modo direto TOConline ativo"
            : "Modo n8n ativo",
        )
        router.refresh()
      } else {
        toast.error("Nao foi possivel alterar o modo", {
          description: body.error ?? `HTTP ${res.status}`,
        })
      }
    } catch (e) {
      toast.error("Erro de rede", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSavingMode(false)
    }
  }

  async function handleSave() {
    if (!clientId || !clientSecret || !accessToken || !refreshToken || !subdomain) {
      toast.error("Todos os campos sao obrigatorios")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/integracoes/toconline/direct", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          access_token: accessToken,
          refresh_token: refreshToken,
          subdomain,
          expires_in: 3600,
        }),
      })
      const body = await res.json()
      if (res.ok && body.ok) {
        toast.success("Credenciais TOConline guardadas")
        setClientSecret("")
        setAccessToken("")
        setRefreshToken("")
        setShowForm(false)
        router.refresh()
      } else {
        toast.error("Falha ao guardar", { description: body.error ?? `HTTP ${res.status}` })
      }
    } catch (e) {
      toast.error("Erro de rede", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!confirm("Desativar integracao TOConline Direct?")) return
    setRemoving(true)
    try {
      const res = await fetch("/api/integracoes/toconline/direct", { method: "DELETE" })
      const body = await res.json()
      if (res.ok && body.ok) {
        toast.success("Integracao desativada")
        router.refresh()
      } else {
        toast.error("Falha ao remover", { description: body.error ?? `HTTP ${res.status}` })
      }
    } catch (e) {
      toast.error("Erro de rede", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setRemoving(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const now = new Date()
      const res = await fetch("/api/faturas/sync-toconline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ month: now.getMonth() + 1, year: now.getFullYear(), type: "both" }),
      })
      const body = await res.json()
      if (res.ok) {
        toast.success("Sync concluido", {
          description: `${body.created ?? 0} criadas - ${body.updated ?? 0} atualizadas${body.errors?.length ? ` - ${body.errors.length} erros` : ""}`,
        })
        router.refresh()
      } else {
        toast.error("Sync falhou", { description: body.error ?? `HTTP ${res.status}` })
      }
    } catch (e) {
      toast.error("Erro de rede", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSyncing(false)
    }
  }

  const tokenExpired =
    initial?.token_expires_at
      ? new Date(initial.token_expires_at) < new Date()
      : false

  const status =
    !initial?.configured || !initial?.is_active
      ? "disconnected"
      : initial.sync_error || tokenExpired
        ? "error"
        : "connected"

  return (
    <Card className={cn(status === "error" && "border-destructive/40")}>
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">ERP - Integracao direta</p>
              <p className="text-xs text-muted-foreground">
                Escolhe o modo de envio de faturas para o ERP. O modo n8n usa o
                teu workflow existente. O modo direto comunica com o TOConline
                sem intermediario.
              </p>
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Seletor de modo */}
        {canEdit && (
          <div className="space-y-1.5">
            <Label htmlFor="integration-mode">Modo de integracao ERP</Label>
            <div className="flex items-center gap-2">
              <Select
                value={mode}
                onValueChange={(v) => handleModeChange(v as IntegrationMode)}
                disabled={savingMode}
              >
                <SelectTrigger id="integration-mode" className="w-[260px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="n8n">
                    Via n8n (webhook dedicado)
                  </SelectItem>
                  <SelectItem value="toconline_direct">
                    Direto TOConline (sem n8n)
                  </SelectItem>
                </SelectContent>
              </Select>
              {savingMode && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {mode === "n8n" && (
              <p className="text-xs text-muted-foreground">
                O n8n recebe um POST assinado (HMAC-SHA256) com os dados da fatura. Configura o webhook na secao acima.
              </p>
            )}
            {mode === "toconline_direct" && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Modo direto: o ISOFlow comunica diretamente com o TOConline. Configura as credenciais OAuth abaixo.
              </p>
            )}
          </div>
        )}

        {/* Detalhes da ligacao atual (modo direto) */}
        {mode === "toconline_direct" && initial?.configured && (
          <div className="text-xs text-muted-foreground space-y-0.5 border-t pt-3">
            {initial.subdomain && (
              <p>
                Subdominio:{" "}
                <span className="font-mono">app{initial.subdomain}.toconline.pt</span>
              </p>
            )}
            {initial.client_id && <p>Client ID: {initial.client_id}</p>}
            {initial.token_expires_at && (
              <p className={cn(tokenExpired && "text-destructive")}>
                Token expira: {formatDate(initial.token_expires_at)}
                {tokenExpired && " (expirado - sera renovado automaticamente)"}
              </p>
            )}
            {initial.last_sync_at && (
              <p>Ultimo sync: {formatDate(initial.last_sync_at)}</p>
            )}
            {initial.sync_error && (
              <p className="text-destructive break-all">{initial.sync_error}</p>
            )}
          </div>
        )}

        {/* Formulario de credenciais (modo direto) */}
        {mode === "toconline_direct" && canEdit && showForm && (
          <div className="space-y-3 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              Obtem as credenciais em{" "}
              <a
                href="https://www.toconline.pt"
                target="_blank"
                rel="noopener noreferrer"
                className="underline inline-flex items-center gap-0.5"
              >
                toconline.pt <ExternalLink className="h-3 w-3" />
              </a>{" "}
              em Definicoes - API OAuth. O subdominio e o numero da tua app (ex: 13 para app13.toconline.pt).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tc-subdomain">Subdominio</Label>
                <Input
                  id="tc-subdomain"
                  placeholder="ex: 13"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tc-client-id">Client ID</Label>
                <Input
                  id="tc-client-id"
                  placeholder="OAuth client_id"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-client-secret">
                Client Secret
                {initial?.has_client_secret && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (deixa em branco para manter o atual)
                  </span>
                )}
              </Label>
              <Input
                id="tc-client-secret"
                type="password"
                placeholder={initial?.has_client_secret ? "•••••••• (atual)" : "OAuth client_secret"}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-access-token">Access Token inicial</Label>
              <Input
                id="tc-access-token"
                type="password"
                placeholder={initial?.has_access_token ? "•••••••• (atual)" : "access_token OAuth"}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-refresh-token">Refresh Token</Label>
              <Input
                id="tc-refresh-token"
                type="password"
                placeholder={initial?.has_refresh_token ? "•••••••• (atual)" : "refresh_token OAuth"}
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar credenciais
              </Button>
            </div>
          </div>
        )}

        {/* Acoes (modo direto configurado) */}
        {mode === "toconline_direct" && !showForm && canEdit && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t">
            {/* Info historico */}
            {initial?.configured && initial.is_active && historicoImportadoAt && (
              <p className="text-xs text-muted-foreground">
                Historico importado em {formatDate(historicoImportadoAt)}
              </p>
            )}
            {!(initial?.configured && initial.is_active && historicoImportadoAt) && <span />}

            <div className="flex flex-wrap items-center gap-2">
              {initial?.configured && initial.is_active && (
                <Button variant="ghost" size="sm" onClick={handleRemove} disabled={removing}>
                  {removing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Desligar
                </Button>
              )}
              {initial?.configured && initial.is_active && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleImportHistory}
                  disabled={importingHistory}
                >
                  {importingHistory ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <History className="mr-2 h-4 w-4" />
                  )}
                  {importingHistory ? "A importar..." : "Importar historico"}
                </Button>
              )}
              {initial?.configured && initial.is_active && (
                <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                  {syncing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Settings2 className="mr-2 h-4 w-4" />
                  )}
                  Sincronizar agora
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
                {initial?.configured ? "Atualizar credenciais" : "Configurar"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: "connected" | "disconnected" | "error" }) {
  const map = {
    connected: {
      label: "Ligado",
      dot: "bg-emerald-500",
      className:
        "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40",
    },
    disconnected: {
      label: "Por configurar",
      dot: "bg-muted-foreground",
      className: "",
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
