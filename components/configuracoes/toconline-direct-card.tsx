"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<IntegrationMode>(integrationMode)
  const [showForm, setShowForm] = useState(false)
  const [savingMode, setSavingMode] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [importingHistory, setImportingHistory] = useState(false)
  const [historicoImportadoAt, setHistoricoImportadoAt] = useState(
    initial?.historico_importado_at ?? null,
  )

  type Categoria = { codigo: string; nome: string; tax_code: string | null }
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaSel, setCategoriaSel] = useState<string>("")
  const [loadingCats, setLoadingCats] = useState(false)
  const [savingCat, setSavingCat] = useState(false)
  const [catsErro, setCatsErro] = useState<string | null>(null)

  const [clientId, setClientId] = useState(initial?.client_id ?? "")
  const [clientSecret, setClientSecret] = useState("")
  const [subdomain, setSubdomain] = useState(initial?.subdomain ?? "")
  const [showManual, setShowManual] = useState(false)
  const [manualAccessToken, setManualAccessToken] = useState("")
  const [manualRefreshToken, setManualRefreshToken] = useState("")
  const [savingManual, setSavingManual] = useState(false)

  useEffect(() => {
    const result = searchParams.get("toconline")
    if (result === "connected") {
      toast.success("TOConline ligado com sucesso")
      router.replace("/configuracoes/integracoes")
    } else if (result === "error") {
      const reason = searchParams.get("reason")
      toast.error("Falha ao ligar ao TOConline", {
        description: reason ?? "Tenta novamente",
      })
      router.replace("/configuracoes/integracoes")
    }
  }, [searchParams, router])

  // Carregar categorias de gasto do TOConline (modo direto e ligacao activa)
  useEffect(() => {
    if (mode !== "toconline_direct" || !initial?.configured || !initial?.is_active) return
    let cancelado = false
    setLoadingCats(true)
    fetch("/api/integracoes/toconline/expense-categories")
      .then((r) => r.json())
      .then((body) => {
        if (cancelado) return
        setCategorias(body.categorias ?? [])
        setCategoriaSel(body.configurada ?? body.default_fallback ?? "")
        setCatsErro(body.erro ?? null)
      })
      .catch(() => {
        if (!cancelado) setCatsErro("Nao foi possivel carregar as categorias")
      })
      .finally(() => {
        if (!cancelado) setLoadingCats(false)
      })
    return () => {
      cancelado = true
    }
  }, [mode, initial?.configured, initial?.is_active])

  async function handleSaveCategoria(codigo: string) {
    setCategoriaSel(codigo)
    setSavingCat(true)
    try {
      const res = await fetch("/api/integracoes/toconline/expense-categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codigo }),
      })
      const body = await res.json()
      if (res.ok && body.ok) {
        toast.success("Categoria de gasto guardada")
        router.refresh()
      } else {
        toast.error("Falha ao guardar categoria", { description: body.error ?? `HTTP ${res.status}` })
      }
    } catch (e) {
      toast.error("Erro de rede", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSavingCat(false)
    }
  }

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
        if (body.errors?.length) {
          toast.warning("Historico importado com erros", {
            description: `${body.months_processed} meses ok, ${body.errors.length} erros: ${body.errors.slice(0, 2).join(" | ")}`,
            duration: 15000,
          })
        } else {
          toast.success("Historico importado", {
            description: `${body.months_processed} meses processados`,
          })
        }
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

  async function handleManualSave() {
    if (!clientId || !clientSecret || !manualAccessToken || !manualRefreshToken || !subdomain) {
      toast.error("Todos os campos sao obrigatorios no modo manual")
      return
    }
    setSavingManual(true)
    try {
      const res = await fetch("/api/integracoes/toconline/direct", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          access_token: manualAccessToken,
          refresh_token: manualRefreshToken,
          subdomain,
          expires_in: 14400,
        }),
      })
      const body = await res.json()
      if (res.ok && body.ok) {
        toast.success("Credenciais guardadas (modo manual)")
        setManualAccessToken("")
        setManualRefreshToken("")
        setClientSecret("")
        setShowManual(false)
        setShowForm(false)
        router.refresh()
      } else {
        toast.error("Falha ao guardar", { description: body.error ?? `HTTP ${res.status}` })
      }
    } catch (e) {
      toast.error("Erro de rede", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSavingManual(false)
    }
  }

  async function handleOAuthStart() {
    const secretRequired = !initial?.has_client_secret
    if (!clientId || !subdomain || (secretRequired && !clientSecret)) {
      toast.error("Preenche subdominio, Client ID e Client Secret")
      return
    }
    if (clientSecret && !initial?.has_client_secret && !secretRequired && !clientSecret) {
      toast.error("Client Secret obrigatorio na primeira configuracao")
      return
    }
    setConnecting(true)
    try {
      const res = await fetch("/api/integracoes/toconline/oauth/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subdomain,
          client_id: clientId,
          client_secret: clientSecret || undefined,
        }),
      })
      const body = await res.json()
      if (res.ok && body.redirect_url) {
        window.location.href = body.redirect_url
      } else {
        toast.error("Falha ao iniciar autorizacao", { description: body.error ?? `HTTP ${res.status}` })
        setConnecting(false)
      }
    } catch (e) {
      toast.error("Erro de rede", { description: e instanceof Error ? e.message : String(e) })
      setConnecting(false)
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

        {/* Categoria de gasto default (modo direto, ligacao activa) */}
        {mode === "toconline_direct" && initial?.configured && initial?.is_active && canEdit && (
          <div className="space-y-1.5 border-t pt-3">
            <Label htmlFor="tc-expense-cat">Categoria de gasto para as faturas</Label>
            <div className="flex items-center gap-2">
              <Select
                value={categoriaSel}
                onValueChange={handleSaveCategoria}
                disabled={loadingCats || savingCat || categorias.length === 0}
              >
                <SelectTrigger id="tc-expense-cat" className="w-full max-w-lg">
                  <SelectValue placeholder={loadingCats ? "A carregar..." : "Escolhe a categoria"} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {categorias.map((c) => (
                    <SelectItem key={c.codigo} value={c.codigo}>
                      {c.codigo} - {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(loadingCats || savingCat) && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Conta usada na linha da fatura de compra criada no TOConline. As categorias vêm
              diretamente da tua contabilidade no TOConline.
            </p>
            {catsErro && <p className="text-xs text-destructive">{catsErro}</p>}
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
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Apos guardar seras redirecionado para o TOConline para autorizar o acesso.
              Certifica-te que o URI de redirect esta registado nas definicoes OAuth:{" "}
              <span className="font-mono">{process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/integracoes/toconline/oauth/callback</span>
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
            {/* Fallback manual */}
            <div className="border-t pt-3">
              <button
                type="button"
                className="text-xs text-muted-foreground underline underline-offset-2"
                onClick={() => setShowManual((v) => !v)}
              >
                {showManual ? "Ocultar entrada manual" : "Nao consigo autorizar - entrar tokens manualmente"}
              </button>
              {showManual && (
                <div className="space-y-3 mt-3">
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Usa isto se o redirect OAuth nao funcionar. Obtem os tokens do n8n ou Postman.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="tc-access-token-manual">Access Token</Label>
                    <Input
                      id="tc-access-token-manual"
                      type="password"
                      placeholder="access_token obtido do n8n ou Postman"
                      value={manualAccessToken}
                      onChange={(e) => setManualAccessToken(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tc-refresh-token-manual">Refresh Token</Label>
                    <Input
                      id="tc-refresh-token-manual"
                      type="password"
                      placeholder="refresh_token obtido do n8n ou Postman"
                      value={manualRefreshToken}
                      onChange={(e) => setManualRefreshToken(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={handleManualSave} disabled={savingManual}>
                      {savingManual && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Guardar tokens manualmente
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={connecting}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleOAuthStart} disabled={connecting}>
                {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {connecting ? "A redirecionar..." : "Ligar ao TOConline"}
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
