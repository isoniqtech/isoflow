import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ChevronLeft,
  Landmark,
  MessageCircle,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IntegrationCard } from "@/components/configuracoes/integration-card"
import { EmailIntegrationCard } from "@/components/configuracoes/email-integration-card"
import { ErpIntegrationCard } from "@/components/configuracoes/erp-integration-card"
import {
  BankConnectButton,
  BankCallbackToast,
} from "@/components/banco/bank-connect"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"
import { formatDate } from "@/lib/utils/portugal"
import { cn } from "@/lib/utils"
import type { IntegrationType } from "@/types"

const PROVIDER_LABELS: Record<string, string> = {
  toconline: "Toconline",
  primavera: "Primavera",
  atura: "Atura",
  tink: "Tink",
  twilio: "Twilio",
  resend: "Resend",
}

type BankingStatus = {
  status: "connected" | "disconnected" | "error" | "soon"
  provider?: string | null
  lastSyncAt?: string | null
  errorMessage?: string | null
  accounts?: Array<{ id: string; name: string; iban?: string | null }>
}

export default async function IntegracoesPage() {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!hasPermission(session.role, "integracoes", "view_all")) {
    redirect("/configuracoes")
  }

  const supabase = createClient()
  const { data: integrations } = await supabase
    .from("tenant_integrations")
    .select("type, provider, is_active, last_sync_at, sync_error, config")
    .eq("tenant_id", session.tenant.id)

  const byType = new Map<
    IntegrationType,
    {
      provider: string
      is_active: boolean
      last_sync_at: string | null
      sync_error: string | null
      config: Record<string, unknown> | null
    }
  >()
  for (const row of integrations ?? []) {
    byType.set(row.type as IntegrationType, {
      provider: row.provider,
      is_active: row.is_active ?? false,
      last_sync_at: row.last_sync_at,
      sync_error: row.sync_error,
      config: (row.config ?? {}) as Record<string, unknown> | null,
    })
  }

  function getStatus(type: IntegrationType): {
    status: "connected" | "disconnected" | "error" | "soon"
    provider?: string | null
    lastSyncAt?: string | null
    errorMessage?: string | null
  } {
    const row = byType.get(type)
    if (!row) return { status: "soon" }
    if (row.sync_error) {
      return {
        status: "error",
        provider: PROVIDER_LABELS[row.provider] ?? row.provider,
        errorMessage: row.sync_error,
      }
    }
    if (row.is_active) {
      return {
        status: "connected",
        provider: PROVIDER_LABELS[row.provider] ?? row.provider,
        lastSyncAt: row.last_sync_at,
      }
    }
    return {
      status: "disconnected",
      provider: PROVIDER_LABELS[row.provider] ?? row.provider,
    }
  }

  const banking = getStatus("banking") as BankingStatus
  const whatsapp = getStatus("whatsapp")

  // ERP/n8n integration — load full record (config) to populate form.
  const erpRow = byType.get("erp")
  type ErpConfigType = { url?: string }
  let erpInitial: {
    id: string
    url: string
    has_secret: boolean
    is_active: boolean
    last_sync_at: string | null
    sync_error: string | null
  } | null = null
  if (erpRow) {
    const { data: row } = await supabase
      .from("tenant_integrations")
      .select("id, config, is_active, last_sync_at, sync_error, api_key_encrypted")
      .eq("type", "erp")
      .eq("provider", "n8n")
      .maybeSingle()
    if (row) {
      const cfg = (row.config ?? {}) as ErpConfigType
      erpInitial = {
        id: row.id,
        url: cfg.url ?? "",
        has_secret: Boolean(row.api_key_encrypted),
        is_active: row.is_active ?? false,
        last_sync_at: row.last_sync_at,
        sync_error: row.sync_error,
      }
    }
  }
  const canEditErp = hasPermission(session.role, "integracoes", "edit")

  // Email IMAP integration — load full record (config) to populate form.
  const emailRow = byType.get("email")
  type EmailConfig = {
    provider: "gmail" | "outlook" | "imap"
    email: string
    imapHost?: string | null
    imapPort?: number | null
    tag?: string | null
  }
  let emailInitial: {
    id: string
    provider: "gmail" | "outlook" | "imap"
    email: string
    imapHost: string | null
    imapPort: number | null
    tag: string | null
    is_active: boolean
    last_sync_at: string | null
    sync_error: string | null
    has_password: boolean
  } | null = null
  if (emailRow) {
    const { data: row } = await supabase
      .from("tenant_integrations")
      .select("id, config, is_active, last_sync_at, sync_error, api_key_encrypted")
      .eq("type", "email")
      .eq("provider", "imap")
      .maybeSingle()
    if (row) {
      const cfg = (row.config ?? {}) as EmailConfig
      emailInitial = {
        id: row.id,
        provider: cfg.provider ?? "gmail",
        email: cfg.email ?? "",
        imapHost: cfg.imapHost ?? null,
        imapPort: cfg.imapPort ?? null,
        tag: cfg.tag ?? null,
        is_active: row.is_active ?? false,
        last_sync_at: row.last_sync_at,
        sync_error: row.sync_error,
        has_password: Boolean(row.api_key_encrypted),
      }
    }
  }
  const canEditEmail = hasPermission(session.role, "integracoes", "edit")

  // Se Tink está ligado, expande detalhes (contas).
  const bankingRow = byType.get("banking")
  const accounts =
    bankingRow?.is_active && bankingRow.config && Array.isArray((bankingRow.config as Record<string, unknown>).accounts)
      ? ((bankingRow.config as { accounts: Array<{ id: string; name: string; iban?: string | null; type?: string }> }).accounts ?? [])
      : []

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <Suspense>
        <BankCallbackToast />
      </Suspense>

      <div>
        <Link
          href="/configuracoes"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Configurações
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Integrações</h1>
        <p className="text-muted-foreground text-sm">
          Liga ERPs, banco e canais de receção de faturas. Configurações
          completas vão sendo ativadas à medida que adicionas as chaves no
          servidor.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ErpIntegrationCard initial={erpInitial} canEdit={canEditErp} />

        {/* Card Banking customizado: usa o BankConnectButton em vez do disabled */}
        <Card className={cn(banking.status === "error" && "border-destructive/40")}>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Landmark className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">Banco (Open Banking)</p>
                  <p className="text-xs text-muted-foreground">
                    Liga uma conta bancária via Tink para conciliação automática.
                  </p>
                </div>
              </div>
              <BankingStatusBadge status={banking.status} />
            </div>

            {banking.status === "connected" && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Tink</span>
                {banking.lastSyncAt && (
                  <> · última sincronização {formatDate(banking.lastSyncAt)}</>
                )}
              </p>
            )}

            {banking.status === "error" && banking.errorMessage && (
              <p className="text-xs text-destructive">{banking.errorMessage}</p>
            )}

            {accounts.length > 0 && (
              <ul className="space-y-1 text-xs">
                {accounts.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-2 py-1.5"
                  >
                    <span className="truncate">{a.name}</span>
                    {a.iban && (
                      <span className="font-mono text-muted-foreground truncate">
                        {a.iban}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <BankConnectButton
                variant={banking.status === "connected" ? "outline" : "default"}
                label={
                  banking.status === "connected"
                    ? "Religar / mudar banco"
                    : "Ligar banco"
                }
              />
            </div>
          </CardContent>
        </Card>

        <IntegrationCard
          icon={MessageCircle}
          title="WhatsApp"
          description="Recebe faturas via WhatsApp. A app processa com IA e associa ao projeto certo."
          status={whatsapp.status}
          provider={whatsapp.provider}
          lastSyncAt={whatsapp.lastSyncAt}
          onConnectLabel="Configurar WhatsApp"
          onConnectTitle="Webhook Twilio será ativado depois do core"
          onConnectDisabled
        />
        <EmailIntegrationCard initial={emailInitial} canEdit={canEditEmail} />
      </div>

      <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
        Estes cards mostram o estado guardado em <code className="text-xs">tenant_integrations</code>.
        À medida que ativarmos cada integração, o botão fica funcional e o
        estado passa a refletir a ligação real.
      </div>
    </div>
  )
}

function BankingStatusBadge({
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
