"use client"

import { useState, type ComponentProps } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ErpIntegrationCard } from "./erp-integration-card"
import { ToconlineDirectCard } from "./toconline-direct-card"
import { N8nLogo, ToconlineLogo } from "./erp-logos"
import type { IntegrationMode } from "@/types"

type ErpInitial = ComponentProps<typeof ErpIntegrationCard>["initial"]
type TcDirectConfig = ComponentProps<typeof ToconlineDirectCard>["initial"]

const OPTIONS: {
  id: IntegrationMode
  label: string
  Logo: typeof N8nLogo
}[] = [
  { id: "n8n", label: "n8n", Logo: N8nLogo },
  { id: "toconline_direct", label: "TOConline", Logo: ToconlineLogo },
]

const BADGE_GREEN =
  "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40"

/**
 * Estado do modo ativo em binario: so' Ligado (ativo, sem erro / token valido)
 * ou Desligado.
 */
function isModeConnected(
  mode: IntegrationMode,
  erpInitial: ErpInitial,
  tcDirectConfig: TcDirectConfig,
): boolean {
  if (mode === "n8n") {
    return Boolean(erpInitial?.is_active && !erpInitial.sync_error)
  }
  const c = tcDirectConfig
  const tokenExpired = c?.token_expires_at
    ? new Date(c.token_expires_at) < new Date()
    : false
  return Boolean(c?.configured && c?.is_active && !c.sync_error && !tokenExpired)
}

/**
 * Quadrado unico do ERP: dois icones (n8n / TOConline) dentro do card escolhem
 * o modo e revelam o detalhe caracteristico de cada um. O modo ativo e'
 * persistido no tenant via /api/integracoes/erp/mode (o mesmo endpoint do antigo
 * seletor dropdown).
 */
export function ErpCard({
  erpInitial,
  tcDirectConfig,
  integrationMode,
  canEdit,
}: {
  erpInitial: ErpInitial
  tcDirectConfig: TcDirectConfig
  integrationMode: IntegrationMode
  canEdit: boolean
}) {
  const router = useRouter()
  const [mode, setMode] = useState<IntegrationMode>(integrationMode)
  const [saving, setSaving] = useState(false)

  // Estado do modo ativo, mostrado no topo do quadrado (como nos outros cartoes).
  const connected = isModeConnected(mode, erpInitial, tcDirectConfig)

  async function selectMode(next: IntegrationMode) {
    if (next === mode) return
    if (!canEdit) {
      setMode(next)
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/integracoes/erp/mode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: next }),
      })
      if (!res.ok) {
        const responseBody = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(responseBody.error ?? "Falha ao mudar o modo do ERP")
        return
      }
      setMode(next)
      toast.success(
        next === "toconline_direct"
          ? "Modo direto TOConline ativo"
          : "Modo n8n ativo",
      )
      router.refresh()
    } catch {
      toast.error("Erro de rede ao mudar o modo do ERP")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="h-full">
      <CardContent className="p-5 space-y-4">
        {/* Seletor de ERP por icone + estado */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex gap-1 rounded-lg border border-border/60 bg-muted p-1">
            {OPTIONS.map(({ id, label, Logo }) => {
              const active = mode === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectMode(id)}
                  disabled={saving}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
                    active
                      ? "bg-card text-foreground shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.08))]"
                      : "text-muted-foreground opacity-70 hover:bg-card/50 hover:text-foreground hover:opacity-100",
                  )}
                >
                  {saving && active ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Logo className="h-4 w-auto shrink-0" />
                  )}
                  {label}
                </button>
              )
            })}
          </div>

          {connected ? (
            <Badge
              variant="outline"
              className={cn("shrink-0 gap-1.5 px-3 py-1 text-sm font-medium", BADGE_GREEN)}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Ligado
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              Desligado
            </Badge>
          )}
        </div>

        {/* Detalhe do modo selecionado (sem card proprio) */}
        {mode === "n8n" ? (
          <ErpIntegrationCard initial={erpInitial} canEdit={canEdit} bare />
        ) : (
          <ToconlineDirectCard
            initial={tcDirectConfig}
            integrationMode="toconline_direct"
            canEdit={canEdit}
            hideModeSelector
            bare
          />
        )}
      </CardContent>
    </Card>
  )
}
