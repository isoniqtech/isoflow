import { createHmac, timingSafeEqual } from "crypto"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { encrypt, decrypt } from "@/lib/utils/encryption"

function verifyState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString()
    const lastColon = decoded.lastIndexOf(":")
    const payload = decoded.slice(0, lastColon)
    const sig = decoded.slice(lastColon + 1)
    const expected = createHmac("sha256", process.env.ENCRYPTION_KEY!).update(payload).digest("hex")
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const colonIdx = payload.indexOf(":")
    const tenantId = payload.slice(0, colonIdx)
    const timestamp = Number(payload.slice(colonIdx + 1))
    if (Date.now() - timestamp > 600_000) return null // expirado apos 10 min
    return tenantId
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  if (error || !code || !state) {
    redirect("/configuracoes/integracoes?toconline=error&reason=cancelled")
  }

  const tenantId = verifyState(state!)
  if (!tenantId) {
    redirect("/configuracoes/integracoes?toconline=error&reason=state")
  }

  const admin = createAdminClient()

  // Recuperar credenciais guardadas no start
  const { data: row } = await admin
    .from("tenant_integrations")
    .select("toconline_client_id, toconline_client_secret_encrypted, config")
    .eq("tenant_id", tenantId!)
    .eq("type", "erp")
    .eq("provider", "toconline")
    .maybeSingle()

  if (!row?.toconline_client_id || !row?.toconline_client_secret_encrypted) {
    redirect("/configuracoes/integracoes?toconline=error&reason=missing_creds")
  }

  const config = (row!.config ?? {}) as Record<string, unknown>
  const subdomain = config.subdomain as string
  const appBase = `https://app${subdomain}.toconline.pt`
  const reqUrl = new URL(req.url)
  const redirectUri = `${reqUrl.protocol}//${reqUrl.host}/api/integracoes/toconline/oauth/callback`

  let clientSecret: string
  try {
    clientSecret = decrypt(row!.toconline_client_secret_encrypted!)
  } catch {
    redirect("/configuracoes/integracoes?toconline=error&reason=decrypt")
  }

  // Trocar codigo por tokens
  const credentials = Buffer.from(`${row!.toconline_client_id}:${clientSecret!}`).toString("base64")
  const tokenRes = await fetch(`${appBase}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code!,
      scope: "commercial",
      redirect_uri: redirectUri,
    }).toString(),
  })

  if (!tokenRes.ok) {
    redirect("/configuracoes/integracoes?toconline=error&reason=token_exchange")
  }

  const tokens = await tokenRes.json()
  if (!tokens.access_token || !tokens.refresh_token) {
    redirect("/configuracoes/integracoes?toconline=error&reason=no_tokens")
  }

  const now = Date.now()
  const expiresIn = tokens.expires_in ?? 14400
  const expiresAt = new Date(now + expiresIn * 1000).toISOString()

  await admin
    .from("tenant_integrations")
    .update({
      is_active: true,
      api_key_encrypted: encrypt(tokens.access_token),
      api_secret_encrypted: encrypt(tokens.refresh_token),
      toconline_token_expires_at: expiresAt,
      config: { ...config, oauth_pending: false },
      sync_error: null,
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId!)
    .eq("type", "erp")
    .eq("provider", "toconline")

  redirect("/configuracoes/integracoes?toconline=connected")
}
