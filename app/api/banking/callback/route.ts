import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { encrypt } from "@/lib/utils/encryption"
import {
  exchangeCode,
  listAccounts,
  type TinkAccount,
} from "@/lib/banking/tink"
import { log } from "@/lib/utils/audit"

export const runtime = "nodejs"

/**
 * Callback redirecionado pelo Tink após o utilizador autorizar acesso ao banco.
 * Esperamos `code` + `state` na query string. O state tem o formato
 * `tenantId.userId.nonce` — validamos a sintaxe; em prod recomenda-se guardar
 * o nonce em DB ou cookie HttpOnly para validação completa contra CSRF.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")
  const errorDescription = url.searchParams.get("error_message")

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? url.origin
  const failureRedirect = (msg: string) =>
    NextResponse.redirect(
      `${appUrl}/configuracoes/integracoes?banking_error=${encodeURIComponent(msg)}`,
    )
  const successRedirect = (count: number) =>
    NextResponse.redirect(
      `${appUrl}/configuracoes/integracoes?banking_connected=${count}`,
    )

  if (error) {
    return failureRedirect(errorDescription || error)
  }
  if (!code || !state) {
    return failureRedirect("Resposta inválida do Tink")
  }

  const parts = state.split(".")
  if (parts.length !== 3) {
    return failureRedirect("State inválido")
  }
  const [tenantId, userId] = parts
  if (!tenantId || !userId) return failureRedirect("State malformado")

  const redirectUri = `${appUrl}/api/banking/callback`

  // Trocar o code por tokens.
  let tokens
  try {
    tokens = await exchangeCode(code, redirectUri)
  } catch (err) {
    console.error("Tink exchangeCode error:", err)
    return failureRedirect("Falha a obter tokens do Tink")
  }

  // Listar contas para confirmar que temos pelo menos uma.
  let accounts: TinkAccount[] = []
  try {
    accounts = await listAccounts(tokens.access_token)
  } catch (err) {
    console.error("Tink listAccounts error:", err)
    return failureRedirect("Falha a listar contas")
  }

  const supabase = createAdminClient()

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  const config = {
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      iban: a.identifiers?.iban?.iban ?? null,
      bic: a.identifiers?.iban?.bic ?? null,
      institution_id: a.financialInstitutionId ?? null,
    })),
    expires_at: expiresAt,
    market: "PT",
  }

  // Upsert: uma única integração banking por tenant (sobrescreve se já existir
  // — Tink dá um novo refresh_token cada vez que o user reautoriza).
  const { error: upsertErr } = await supabase
    .from("tenant_integrations")
    .upsert(
      {
        tenant_id: tenantId,
        type: "banking",
        provider: "tink",
        api_key_encrypted: encrypt(tokens.access_token),
        api_secret_encrypted: tokens.refresh_token
          ? encrypt(tokens.refresh_token)
          : null,
        config,
        is_active: true,
        sync_error: null,
        last_sync_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,type,provider" },
    )

  if (upsertErr) {
    console.error("tenant_integrations upsert error:", upsertErr)
    return failureRedirect("Falha a guardar a ligação")
  }

  await log(supabase, {
    action: "bank.connected",
    tenantId,
    userId,
    resourceType: "tenant_integration",
    metadata: { provider: "tink", account_count: accounts.length },
  })

  return successRedirect(accounts.length)
}
