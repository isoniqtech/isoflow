import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ChevronLeft,
  MessageCircle,
} from "lucide-react"
import { IntegrationCard } from "@/components/configuracoes/integration-card"
import { EmailIntegrationCard } from "@/components/configuracoes/email-integration-card"
import { ErpIntegrationCard } from "@/components/configuracoes/erp-integration-card"
import { BankAccountsCard } from "@/components/configuracoes/bank-accounts-card"
import { BankCallbackToast } from "@/components/banco/bank-connect"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"
import type { IntegrationType } from "@/types"
import type { BankAccountConfig } from "@/app/api/integracoes/banco/route"

const PROVIDER_LABELS: Record<string, string> = {
  toconline: "Toconline",
  primavera: "Primavera",
  atura: "Atura",
  twilio: "Twilio",
  resend: "Resend",
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

  // Contas bancárias manuais
  const bankingRow = byType.get("banking")
  const bankAccounts: BankAccountConfig[] = Array.isArray(
    (bankingRow?.config as Record<string, unknown> | null | undefined)?.accounts,
  )
    ? ((bankingRow!.config as { accounts: BankAccountConfig[] }).accounts)
    : []
  const canEditBanking = hasPermission(session.role, "integracoes", "edit")

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

        <BankAccountsCard initial={bankAccounts} canEdit={canEditBanking} />

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

