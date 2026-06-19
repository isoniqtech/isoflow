import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import { decrypt } from "@/lib/utils/encryption"
import {
  fetchNewEmailsOnConnection,
  markAsRead,
  withInbox,
  type DateRange,
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
  /** Emails UNSEEN totais antes de filtrar por tag. */
  emailsPrefilter: number
  /** Emails que passaram o filtro de tag e foram processados. */
  emailsFetched: number
  /** Endereços de To: encontrados nos emails rejeitados pela tag (debug). */
  rejectedAddresses: string[]
  results: ProcessingResult[]
  errors: string[]
  /** True quando outro sync já estava em curso e não tentámos nada. */
  alreadyRunning?: boolean
}

/**
 * Duração máxima esperada de um sync. Se ultrapassado, o lock expira
 * sozinho e outro sync pode arrancar. Suficientemente longo para 50
 * emails com Claude AI (cada ~5-15s).
 */
const LOCK_TTL_MS = 10 * 60 * 1000 // 10 minutos

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
  dateRange: DateRange,
): Promise<SyncSummary> {
  const summary: SyncSummary = {
    tenantId,
    emailsPrefilter: 0,
    emailsFetched: 0,
    rejectedAddresses: [],
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

  // Lock atómico via RPC — usa função SQL que contorna o schema cache do PostgREST.
  const lockUntil = new Date(Date.now() + LOCK_TTL_MS).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: acquired, error: lockErr } = await (admin as any).rpc(
    "acquire_email_sync_lock",
    { p_integration_id: integration.id, p_lock_until: lockUntil },
  )
  if (lockErr) {
    summary.errors.push(`Lock acquire: ${lockErr.message}`)
    return summary
  }
  if (!acquired) {
    summary.alreadyRunning = true
    summary.errors.push(
      "Outra sincronização ainda está a correr — espera ~1 minuto",
    )
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
      const fetched = await fetchNewEmailsOnConnection(conn, credentials, dateRange)
      summary.emailsPrefilter = fetched.prefilterCount
      summary.emailsFetched = fetched.matched.length
      summary.rejectedAddresses = fetched.rejectedAddresses

      for (const { uid, parsed, wasUnseen } of fetched.matched) {
        try {
          const result = await processEmailInvoice(parsed, tenantId, admin)
          summary.results.push(result)

          // Só marcamos como lido se era não lido e não foi skipped por créditos
          // (mantemos não lido se sem créditos para o user ver).
          if (wasUnseen && (!result.skipped || result.reason === "already_processed")) {
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
        sync_locked_until: null,
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
        sync_locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id)
  }

  return summary
}
