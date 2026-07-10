/**
 * Gestao de token OAuth TOConline para modo direto (toconline_direct).
 * O n8n tem o seu proprio mecanismo de refresh - este ficheiro e usado
 * EXCLUSIVAMENTE no caminho toconline_direct. Nunca tocar no caminho n8n.
 *
 * Estrategia: token valido por timestamp absoluto. Se expirar em < 60s,
 * faz refresh. Persiste sempre o refresh_token devolvido (TOConline pode
 * rotaciona-lo). Em caso de falha, grava sync_error e lanca excepcao.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { decrypt, encrypt, decryptOptional } from "@/lib/utils/encryption"

export interface TOCTokenConfig {
  accessToken: string
  appBase: string
  apiBase: string
}

interface OAuthResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
}

async function refreshOAuthToken(
  appBase: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<OAuthResponse> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
  const url = `${appBase.replace(/\/$/, "")}/oauth/token`

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: "commercial",
    }).toString(),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`refresh_token falhou ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  if (!data.access_token) {
    throw new Error("refresh_token: resposta sem access_token")
  }
  return data as OAuthResponse
}

/**
 * Fallback de re-autorizacao server-side (replica o mecanismo do n8n):
 * chama /oauth/auth com o Bearer token atual - o TOConline devolve um code
 * sem interacao do utilizador se o token ainda for valido.
 * So e chamado quando grant_type=refresh_token falha.
 */
async function reauthorizeWithToken(
  appBase: string,
  clientId: string,
  clientSecret: string,
  currentAccessToken: string,
  redirectUri: string,
): Promise<OAuthResponse> {
  const base = appBase.replace(/\/$/, "")
  const authUrl =
    `${base}/oauth/auth` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=commercial`

  const authRes = await fetch(authUrl, {
    headers: { Authorization: `Bearer ${currentAccessToken}`, Accept: "*/*" },
    redirect: "follow",
  })

  const html = await authRes.text().catch(() => "")

  // TOConline devolve {"code":"..."} dentro de um <pre> ou na URL
  let code: string | null = null
  let m = html.match(/&quot;code&quot;\s*:\s*&quot;([^&]+?)&quot;/)
  if (!m) m = html.match(/"code"\s*:\s*"([^"]+?)"/)
  if (!m) m = html.match(/[?&]code=([^&\s<"]+)/)
  if (m) code = decodeURIComponent(m[1])

  if (!code) throw new Error("Nao foi possivel extrair OAuth code da pagina de auth")

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
  const tokenRes = await fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      scope: "commercial",
      redirect_uri: redirectUri,
    }).toString(),
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => "")
    throw new Error(`re-auth token exchange falhou ${tokenRes.status}: ${text.slice(0, 200)}`)
  }

  const data = await tokenRes.json()
  if (!data.access_token) throw new Error("re-auth: resposta sem access_token")
  return data as OAuthResponse
}

/**
 * Devolve um token de acesso valido para o tenant.
 * Se o token expirar em menos de 60 segundos, faz refresh automatico.
 * Lanca erro se o refresh falhar (caller deve apanhar e mostrar na UI).
 */
export async function getValidToken(tenantId: string): Promise<TOCTokenConfig> {
  const admin = createAdminClient()

  // Cast para unknown primeiro - as colunas novas (migration 037) ainda nao estao
  // em types/supabase.ts (ficheiro auto-gerado). Substituir apos regenerar os tipos.
  const { data: rowRaw, error: fetchErr } = await admin
    .from("tenant_integrations")
    .select(
      "api_key_encrypted, api_secret_encrypted, toconline_client_id, toconline_client_secret_encrypted, toconline_token_expires_at, config",
    )
    .eq("tenant_id", tenantId)
    .eq("type", "erp")
    .eq("provider", "toconline")
    .eq("is_active", true)
    .maybeSingle()

  if (fetchErr || !rowRaw) {
    throw new Error("Integracao TOConline nao encontrada ou inativa")
  }

  const row = rowRaw as {
    api_key_encrypted: string | null
    api_secret_encrypted: string | null
    toconline_client_id: string | null
    toconline_client_secret_encrypted: string | null
    toconline_token_expires_at: string | null
    config: Record<string, unknown> | null
  }

  const config = (row.config ?? {}) as Record<string, unknown>
  const subdomain = config.subdomain as string | number | undefined
  const appBase = subdomain
    ? `https://app${subdomain}.toconline.pt`
    : ((config.base_url as string | undefined) ?? "https://app.toconline.pt")
  const apiBase = subdomain
    ? `https://api${subdomain}.toconline.pt`
    : appBase

  let accessToken: string | null = null
  try {
    accessToken = decryptOptional(row.api_key_encrypted)
  } catch {
    // desencriptacao falhou - token invalido, tentar refresh abaixo
  }

  // Verificar se o token ainda e valido
  const expiresAt = row.toconline_token_expires_at
    ? new Date(row.toconline_token_expires_at).getTime()
    : 0
  const now = Date.now()
  const BUFFER_MS = 60_000 // renovar 60s antes de expirar

  if (accessToken && expiresAt > now + BUFFER_MS) {
    return { accessToken, appBase, apiBase }
  }

  // Token expirado ou a expirar - tentar refresh
  const clientId = row.toconline_client_id
  let clientSecret: string | null = null
  try {
    clientSecret = decryptOptional(row.toconline_client_secret_encrypted)
  } catch {}

  let refreshToken: string | null = null
  try {
    refreshToken = decryptOptional(row.api_secret_encrypted)
  } catch {}

  if (!clientId || !clientSecret || !refreshToken) {
    // Sem credenciais para refresh - usa token atual se existir, ou falha
    if (accessToken) {
      return { accessToken, appBase, apiBase }
    }
    throw new Error(
      "Token TOConline expirado e sem credenciais OAuth para renovar. " +
        "Configura client_id, client_secret e refresh_token nas definicoes.",
    )
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integracoes/toconline/oauth/callback`

  let refreshResult: OAuthResponse | null = null

  // 1a tentativa: grant_type=refresh_token (standard OAuth)
  try {
    refreshResult = await refreshOAuthToken(appBase, clientId, clientSecret, refreshToken)
  } catch {
    // Falhou - tentar fallback server-side (mecanismo n8n)
  }

  // 2a tentativa: re-autorizacao server-side com token atual (fallback n8n)
  if (!refreshResult && accessToken) {
    try {
      refreshResult = await reauthorizeWithToken(
        appBase,
        clientId,
        clientSecret,
        accessToken,
        redirectUri,
      )
    } catch {
      // Ambas falharam - registar erro abaixo
    }
  }

  if (!refreshResult) {
    const msg = "Nao foi possivel renovar o token (refresh_token e re-auth falharam). Volta a ligar o TOConline nas definicoes."
    await admin
      .from("tenant_integrations")
      .update({
        sync_error: msg.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("type", "erp")
      .eq("provider", "toconline")

    await admin.from("audit_logs").insert({
      tenant_id: tenantId,
      user_id: null,
      action: "toconline_token_refresh_failed",
      resource_type: "tenant_integrations",
      metadata: { error: msg },
    })

    throw new Error(`TOConline: ${msg}`)
  }

  const newAccessToken = refreshResult.access_token
  const newRefreshToken = refreshResult.refresh_token ?? refreshToken
  const expiresIn = refreshResult.expires_in ?? 3600
  const newExpiresAt = new Date(now + expiresIn * 1000).toISOString()

  await admin
    .from("tenant_integrations")
    .update({
      api_key_encrypted: encrypt(newAccessToken),
      api_secret_encrypted: encrypt(newRefreshToken),
      toconline_token_expires_at: newExpiresAt,
      sync_error: null,
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("type", "erp")
    .eq("provider", "toconline")

  return { accessToken: newAccessToken, appBase, apiBase }
}

/**
 * Salva as credenciais OAuth iniciais (primeiro setup) ou atualiza.
 * Chamado pela UI de configuracoes ao guardar o formulario TOConline Direct.
 */
export async function saveInitialCredentials(
  tenantId: string,
  opts: {
    clientId: string
    clientSecret: string
    accessToken: string
    refreshToken: string
    expiresIn: number
    subdomain: string | number
  },
): Promise<void> {
  const admin = createAdminClient()
  const expiresAt = new Date(Date.now() + opts.expiresIn * 1000).toISOString()

  await admin.from("tenant_integrations").upsert(
    {
      tenant_id: tenantId,
      type: "erp",
      provider: "toconline",
      is_active: true,
      toconline_client_id: opts.clientId,
      toconline_client_secret_encrypted: encrypt(opts.clientSecret),
      api_key_encrypted: encrypt(opts.accessToken),
      api_secret_encrypted: encrypt(opts.refreshToken),
      toconline_token_expires_at: expiresAt,
      config: { subdomain: String(opts.subdomain) },
      sync_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,type,provider" },
  )
}
