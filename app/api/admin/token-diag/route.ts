/**
 * ROTA TEMPORÁRIA DE DIAGNÓSTICO - remover após diagnosticar o refresh do token.
 * Só super-admin. Testa, para a Revive, o re-auth (GET /oauth/auth com Bearer) e
 * o grant refresh_token, devolvendo o que o TOConline responde. Não expõe tokens.
 */
import { getApiContext, jsonError } from "@/lib/api/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { decryptOptional } from "@/lib/utils/encryption"

export const runtime = "nodejs"
export const maxDuration = 60

const REVIVE_TENANT_ID = "475826a5-d08c-4e99-8b95-39b48a245949"

function safeDecrypt(v: string | null): string | null {
  try {
    return decryptOptional(v)
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (process.env.SUPER_ADMIN_USER_ID !== ctx.userId) return jsonError("Forbidden", 403)

  const { searchParams } = new URL(req.url)
  const tenantId = searchParams.get("tenant") || REVIVE_TENANT_ID

  const admin = createAdminClient()
  const { data: rowRaw } = await admin
    .from("tenant_integrations")
    .select(
      "api_key_encrypted, api_secret_encrypted, toconline_client_id, toconline_client_secret_encrypted, toconline_token_expires_at, config",
    )
    .eq("tenant_id", tenantId)
    .eq("type", "erp")
    .eq("provider", "toconline")
    .maybeSingle()

  if (!rowRaw) return Response.json({ error: "sem integracao TOConline" })

  const r = rowRaw as {
    api_key_encrypted: string | null
    api_secret_encrypted: string | null
    toconline_client_id: string | null
    toconline_client_secret_encrypted: string | null
    toconline_token_expires_at: string | null
    config: Record<string, unknown> | null
  }

  const config = (r.config ?? {}) as Record<string, unknown>
  const subdomain = config.subdomain as string | number | undefined
  const appBase = subdomain ? `https://app${subdomain}.toconline.pt` : "https://app.toconline.pt"
  const accessToken = safeDecrypt(r.api_key_encrypted)
  const refreshToken = safeDecrypt(r.api_secret_encrypted)
  const clientId = r.toconline_client_id
  const clientSecret = safeDecrypt(r.toconline_client_secret_encrypted)
  const redirectUri =
    (config.redirect_uri as string | undefined) ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/integracoes/toconline/oauth/callback`

  const nowMs = Date.now()
  const expMs = r.toconline_token_expires_at ? new Date(r.toconline_token_expires_at).getTime() : 0
  const out: Record<string, unknown> = {
    tenantId,
    appBase,
    redirectUri,
    token_expires_at: r.toconline_token_expires_at,
    now: new Date().toISOString(),
    minutos_ate_expirar: expMs ? Math.round((expMs - nowMs) / 60000) : null,
    tem: {
      accessToken: !!accessToken,
      refreshToken: !!refreshToken,
      clientId: !!clientId,
      clientSecret: !!clientSecret,
    },
  }

  // 1) re-auth: GET /oauth/auth com Bearer do access token atual
  try {
    const authUrl =
      `${appBase}/oauth/auth?client_id=${encodeURIComponent(clientId ?? "")}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=commercial`
    const res = await fetch(authUrl, {
      headers: { Authorization: `Bearer ${accessToken ?? ""}`, Accept: "*/*" },
      redirect: "follow",
    })
    const html = await res.text()
    // Extrair o code do URL final PRIMEIRO (correcao), depois do HTML
    let code: string | null = null
    for (const src of [res.url ?? "", html]) {
      const mm =
        src.match(/[?&]code=([^&\s<"]+)/) ||
        src.match(/&quot;code&quot;\s*:\s*&quot;([^&]+?)&quot;/) ||
        src.match(/"code"\s*:\s*"([^"]+?)"/)
      if (mm) {
        code = decodeURIComponent(mm[1])
        break
      }
    }
    out.reauth = {
      http_status: res.status,
      final_url: res.url,
      code_encontrado: !!code,
      html_length: html.length,
    }

    // Testar a TROCA completa: code -> tokens (grant authorization_code)
    if (code) {
      const creds = Buffer.from(`${clientId ?? ""}:${clientSecret ?? ""}`).toString("base64")
      const tk = await fetch(`${appBase}/oauth/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${creds}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({ grant_type: "authorization_code", code, scope: "commercial" }).toString(),
      })
      const tb = await tk.text()
      let tp: Record<string, unknown> | null = null
      try {
        tp = JSON.parse(tb)
      } catch {
        tp = null
      }
      out.reauth_exchange = tp?.access_token
        ? { http_status: tk.status, resultado: "SUCESSO (tokens recebidos)", expires_in: tp.expires_in }
        : { http_status: tk.status, body: tb.slice(0, 400) }
    }
  } catch (e) {
    out.reauth = { error: e instanceof Error ? e.message : String(e) }
  }

  // 2) grant refresh_token (esperado unauthorized_client se o app nao o suporta)
  try {
    const creds = Buffer.from(`${clientId ?? ""}:${clientSecret ?? ""}`).toString("base64")
    const res = await fetch(`${appBase}/oauth/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken ?? "",
        scope: "commercial",
      }).toString(),
    })
    const body = await res.text()
    let parsed: Record<string, unknown> | null = null
    try {
      parsed = JSON.parse(body)
    } catch {
      parsed = null
    }
    out.refresh_token = parsed?.access_token
      ? { http_status: res.status, resultado: "SUCESSO (tokens recebidos, ocultados)" }
      : { http_status: res.status, body: body.slice(0, 400) }
  } catch (e) {
    out.refresh_token = { error: e instanceof Error ? e.message : String(e) }
  }

  return Response.json(out)
}
