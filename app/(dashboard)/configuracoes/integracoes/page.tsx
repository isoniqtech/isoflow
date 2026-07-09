import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { IntegrationCard } from "@/components/configuracoes/integration-card"
import { EmailIntegrationCard } from "@/components/configuracoes/email-integration-card"
import { ErpIntegrationCard } from "@/components/configuracoes/erp-integration-card"
import { WhatsAppIntegrationCard } from "@/components/configuracoes/whatsapp-integration-card"
import { BankAccountsCard } from "@/components/configuracoes/bank-accounts-card"
import { ToconlineDirectCard } from "@/components/configuracoes/toconline-direct-card"
import { AiIntegrationCard } from "@/components/configuracoes/ai-integration-card"
import { BankCallbackToast } from "@/components/banco/bank-connect"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"
import type { IntegrationType, IntegrationMode } from "@/types"
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

  const canEditWhatsapp = hasPermission(session.role, "integracoes", "edit")

  // WhatsApp
  const { data: waFullRow } = await supabase
    .from("tenant_integrations")
    .select("is_active, api_key_encrypted, config")
    .eq("tenant_id", session.tenant.id)
    .eq("type", "whatsapp")
    .eq("provider", "twilio")
    .maybeSingle()

  const whatsappActive = waFullRow?.is_active ?? false
  const whatsappHasCredentials = Boolean(waFullRow?.api_key_encrypted)
  const whatsappPhoneNumber =
    ((waFullRow?.config as Record<string, unknown> | null)?.phone_number as string | null) ?? null

  // ERP n8n
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
      .eq("tenant_id", session.tenant.id)
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

  // Modo de integracao ERP do tenant
  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("integration_mode")
    .eq("id", session.tenant.id)
    .maybeSingle()
  const integrationMode: IntegrationMode =
    ((tenantRow as { integration_mode?: string } | null)?.integration_mode as IntegrationMode) ??
    "n8n"

  // TOConline Direct
  const { data: tcDirectRow } = await supabase
    .from("tenant_integrations")
    .select(
      "toconline_client_id, toconline_client_secret_encrypted, api_key_encrypted, api_secret_encrypted, toconline_token_expires_at, config, is_active, last_sync_at, sync_error",
    )
    .eq("tenant_id", session.tenant.id)
    .eq("type", "erp")
    .eq("provider", "toconline")
    .maybeSingle()

  const tcDirectConfig = tcDirectRow
    ? {
        configured: true,
        client_id: tcDirectRow.toconline_client_id ?? null,
        has_client_secret: Boolean(tcDirectRow.toconline_client_secret_encrypted),
        has_access_token: Boolean(tcDirectRow.api_key_encrypted),
        has_refresh_token: Boolean(tcDirectRow.api_secret_encrypted),
        token_expires_at: tcDirectRow.toconline_token_expires_at ?? null,
        subdomain:
          ((tcDirectRow.config as Record<string, unknown> | null)?.subdomain as string | null) ??
          null,
        historico_importado_at:
          ((tcDirectRow.config as Record<string, unknown> | null)?.historico_importado_at as string | null) ??
          null,
        is_active: tcDirectRow.is_active ?? false,
        last_sync_at: tcDirectRow.last_sync_at,
        sync_error: tcDirectRow.sync_error,
      }
    : null

  // AI Anthropic por tenant
  const { data: aiRow } = await supabase
    .from("tenant_integrations")
    .select("api_key_encrypted, config, is_active, last_sync_at, sync_error")
    .eq("tenant_id", session.tenant.id)
    .eq("type", "ai")
    .eq("provider", "anthropic")
    .maybeSingle()

  const aiConfig = aiRow
    ? {
        configured: true,
        has_key: Boolean(aiRow.api_key_encrypted),
        model: ((aiRow.config as Record<string, unknown> | null)?.model as string | null) ?? null,
        is_active: aiRow.is_active ?? false,
        last_sync_at: aiRow.last_sync_at,
        sync_error: aiRow.sync_error,
      }
    : null

  // Email IMAP
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

  // Contas bancarias manuais
  const bankingRow = byType.get("banking")
  const bankAccounts: BankAccountConfig[] = Array.isArray(
    (bankingRow?.config as Record<string, unknown> | null | undefined)?.accounts,
  )
    ? (bankingRow!.config as { accounts: BankAccountConfig[] }).accounts
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
          Configuracoes
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Integracoes</h1>
        <p className="text-muted-foreground text-sm">
          Liga ERPs, banco e canais de rececao de faturas. Configuracoes
          completas vao sendo ativadas a medida que adicionas as chaves no
          servidor.
        </p>
      </div>

      <div className="space-y-3">
        {/* ERP - modo n8n (card original intocado quando modo = n8n) */}
        <ErpIntegrationCard initial={erpInitial} canEdit={canEditErp} />

        {/* ERP - modo direto TOConline (seletor de modo + credenciais) */}
        <ToconlineDirectCard
          initial={tcDirectConfig}
          integrationMode={integrationMode}
          canEdit={canEditErp}
        />

        <BankAccountsCard initial={bankAccounts} canEdit={canEditBanking} />

        <WhatsAppIntegrationCard
          isActive={whatsappActive}
          hasCredentials={whatsappHasCredentials}
          phoneNumber={whatsappPhoneNumber}
          canEdit={canEditWhatsapp}
        />

        <EmailIntegrationCard initial={emailInitial} canEdit={canEditEmail} />

        {/* IA - chave Anthropic por tenant */}
        <AiIntegrationCard initial={aiConfig} canEdit={canEditErp} />
      </div>
    </div>
  )
}
