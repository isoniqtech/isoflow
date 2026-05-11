import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import { decrypt } from "@/lib/utils/encryption"
import {
  fetchNewEmailsOnConnection,
  markAsRead,
  withInbox,
  type EmailCredentials,
  type EmailProvider,
} from "@/lib/email/gmail-imap"
import { processEmailInvoice, type ProcessingResult } from "@/lib/email/process-email"

type Client = SupabaseClient<Database>

type IntegrationConfig = {
  provider: EmailProvider
  email: string
  imapHost?: string | null
  imapPort?: number | null
  tag?: string | null
}

export interface SyncSummary {
  tenantId: string
  emailsFetched: number
  results: ProcessingResult[]
  errors: string[]
}

/**
 * Faz fetch dos emails não lidos da integração IMAP ativa do tenant,
 * processa cada um (extrai anexos → AI → cria invoice → debita créditos)
 * e marca como lido no IMAP.
 *
 * Recebe um admin client (service role) porque corre fora do contexto
 * de utilizador (manual sync ou cron).
 */
export async function syncTenantEmails(
  admin: Client,
  tenantId: string,
): Promise<SyncSummary> {
  const summary: SyncSummary = {
    tenantId,
    emailsFetched: 0,
    results: [],
    errors: [],
  }

  const { data: integration } = await admin
    .from("tenant_integrations")
    .select("id, api_key_encrypted, config")
    .eq("tenant_id", tenantId)
    .eq("type", "email")
    .eq("provider", "imap")
    .eq("is_active", true)
    .maybeSingle()

  if (!integration) {
    summary.errors.push("Sem integração de email ativa")
    return summary
  }
  if (!integration.api_key_encrypted) {
    summary.errors.push("Integração sem credenciais")
    return summary
  }

  let password: string
  try {
    password = decrypt(integration.api_key_encrypted)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    summary.errors.push(`Decrypt password: ${msg}`)
    return summary
  }

  const config = (integration.config ?? {}) as IntegrationConfig
  const credentials: EmailCredentials = {
    provider: config.provider,
    email: config.email,
    appPassword: password,
    imapHost: config.imapHost ?? undefined,
    imapPort: config.imapPort ?? undefined,
    tag: config.tag ?? null,
  }

  try {
    await withInbox(credentials, async (conn) => {
      const messages = await fetchNewEmailsOnConnection(conn, credentials)
      summary.emailsFetched = messages.length

      for (const { uid, parsed } of messages) {
        try {
          const result = await processEmailInvoice(parsed, tenantId, admin)
          summary.results.push(result)

          // Só marcamos como lido se NÃO foi skipped por já-processado
          // (mantemos não lido se foi skipped por créditos para o user ver).
          if (!result.skipped || result.reason === "already_processed") {
            try {
              await markAsRead(conn, uid)
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e)
              summary.errors.push(`markAsRead uid=${uid}: ${msg}`)
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          summary.errors.push(`process uid=${uid}: ${msg}`)
        }
      }
    })

    await admin
      .from("tenant_integrations")
      .update({
        last_sync_at: new Date().toISOString(),
        sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    summary.errors.push(`IMAP: ${msg}`)
    await admin
      .from("tenant_integrations")
      .update({
        sync_error: msg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id)
  }

  return summary
}
