import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { decrypt, encrypt } from "@/lib/utils/encryption"
import {
  listTransactions,
  refreshAccessToken,
  tinkAmountToNumber,
  tinkTransactionDescription,
  type TinkTransaction,
} from "@/lib/banking/tink"
import { log } from "@/lib/utils/audit"

export const runtime = "nodejs"

type IntegrationConfig = {
  accounts?: Array<{
    id: string
    name: string
    iban?: string | null
    type?: string
  }>
  expires_at?: string
  market?: string
}

/**
 * Sincronização manual de transações Tink para todas as contas ligadas
 * deste tenant. Faz refresh do access_token se estiver expirado, descarrega
 * transações dos últimos 90 dias e faz upsert em bank_transactions.
 *
 * Idempotente — usa external_id para evitar duplicar.
 */
export async function POST() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "banco", "view_all")) {
    return jsonError("Forbidden", 403)
  }

  const supabase = createClient()
  const admin = createAdminClient()

  // RLS via supabase normal apanha o tenant — buscamos a integração ativa.
  const { data: integration } = await supabase
    .from("tenant_integrations")
    .select(
      "id, api_key_encrypted, api_secret_encrypted, config, last_sync_at",
    )
    .eq("type", "banking")
    .eq("provider", "tink")
    .eq("is_active", true)
    .maybeSingle()

  if (!integration) {
    return jsonError("Sem ligação Tink ativa", 404)
  }

  const config = (integration.config ?? {}) as IntegrationConfig
  const accounts = config.accounts ?? []
  if (accounts.length === 0) {
    return jsonError("Sem contas associadas à ligação Tink", 400)
  }

  let accessToken: string
  try {
    accessToken = decrypt(integration.api_key_encrypted ?? "")
  } catch (err) {
    console.error("Tink decrypt access_token failed:", err)
    return jsonError("Token corrupto, religa o banco", 500)
  }

  // Refresh se expirado.
  const expiresAt = config.expires_at ? new Date(config.expires_at) : null
  const needsRefresh = !expiresAt || expiresAt.getTime() <= Date.now() + 60_000

  if (needsRefresh) {
    if (!integration.api_secret_encrypted) {
      return jsonError(
        "Token Tink expirado e sem refresh token — religa o banco",
        400,
      )
    }
    let refreshTokenPlain: string
    try {
      refreshTokenPlain = decrypt(integration.api_secret_encrypted)
    } catch {
      return jsonError("Refresh token corrupto, religa o banco", 500)
    }

    try {
      const refreshed = await refreshAccessToken(refreshTokenPlain)
      accessToken = refreshed.access_token

      const newConfig: IntegrationConfig = {
        ...config,
        expires_at: new Date(
          Date.now() + refreshed.expires_in * 1000,
        ).toISOString(),
      }

      await admin
        .from("tenant_integrations")
        .update({
          api_key_encrypted: encrypt(accessToken),
          api_secret_encrypted: refreshed.refresh_token
            ? encrypt(refreshed.refresh_token)
            : integration.api_secret_encrypted,
          config: newConfig,
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration.id)
    } catch (err) {
      console.error("Tink refresh failed:", err)
      await admin
        .from("tenant_integrations")
        .update({
          sync_error: "Refresh token inválido — religa o banco",
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration.id)
      return jsonError("Não foi possível renovar token Tink", 401)
    }
  }

  // Janela: últimos 90 dias.
  const since = new Date()
  since.setDate(since.getDate() - 90)
  const sinceStr = since.toISOString().slice(0, 10)

  let allTransactions: TinkTransaction[] = []
  try {
    let pageToken: string | undefined = undefined
    do {
      const page = await listTransactions(accessToken, {
        accountIdIn: accounts.map((a) => a.id),
        bookedDateGte: sinceStr,
        pageSize: 100,
        pageToken,
      })
      allTransactions = allTransactions.concat(page.transactions)
      pageToken = page.nextPageToken
      if (allTransactions.length >= 1000) break // safety cap
    } while (pageToken)
  } catch (err) {
    console.error("Tink listTransactions failed:", err)
    await admin
      .from("tenant_integrations")
      .update({
        sync_error: (err as Error).message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id)
    return jsonError("Falha a obter transações do Tink", 502)
  }

  // Upsert transactions.
  const accountMap = new Map(accounts.map((a) => [a.id, a]))
  const rows = allTransactions.map((t) => {
    const acct = accountMap.get(t.accountId)
    const amount = tinkAmountToNumber(t.amount.value)

    // Counterparty: para débitos é payee (a quem pagámos),
    // para créditos é payer (quem nos pagou).
    const counterparty =
      amount < 0 ? t.counterparties?.payee : t.counterparties?.payer
    const counterpartyName = counterparty?.name ?? null
    const counterpartyIban =
      counterparty?.identifiers?.financialInstitution?.accountNumber ?? null

    return {
      tenant_id: ctx.tenantId,
      external_id: t.id,
      account_id: t.accountId,
      account_name: acct?.name ?? null,
      bank_name: null,
      iban: acct?.iban ?? null,
      date: t.dates.booked ?? t.dates.value ?? new Date().toISOString().slice(0, 10),
      value_date: t.dates.value ?? null,
      amount,
      currency: t.amount.currencyCode ?? "EUR",
      description: tinkTransactionDescription(t),
      type: amount < 0 ? ("debit" as const) : ("credit" as const),
      category: t.categories?.pfm?.name ?? null,
      counterparty_name: counterpartyName,
      counterparty_iban: counterpartyIban,
      bank_reference: t.reference ?? null,
      external_status: t.status ?? null,
      raw_data: t as unknown as never,
    }
  })

  let inserted = 0
  if (rows.length > 0) {
    // Idempotência: só inserir os que ainda não existem.
    const externalIds = rows.map((r) => r.external_id)
    const { data: existing } = await admin
      .from("bank_transactions")
      .select("external_id")
      .eq("tenant_id", ctx.tenantId)
      .in("external_id", externalIds)
    const existingSet = new Set(
      (existing ?? []).map((r) => r.external_id).filter(Boolean),
    )
    const toInsert = rows.filter((r) => !existingSet.has(r.external_id))

    if (toInsert.length > 0) {
      const { error: insertErr } = await admin
        .from("bank_transactions")
        .insert(toInsert)
      if (insertErr) {
        console.error("bank_transactions insert error:", insertErr)
        await admin
          .from("tenant_integrations")
          .update({
            sync_error: insertErr.message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", integration.id)
        return jsonError("Falha a gravar transações", 500)
      }
      inserted = toInsert.length
    }
  }

  await admin
    .from("tenant_integrations")
    .update({
      last_sync_at: new Date().toISOString(),
      sync_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id)

  await log(admin, {
    action: "bank.synced",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "tenant_integration",
    metadata: {
      total_fetched: allTransactions.length,
      inserted,
      accounts: accounts.length,
    },
  })

  return Response.json({
    data: {
      total: allTransactions.length,
      inserted,
      accounts: accounts.length,
    },
  })
}
