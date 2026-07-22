/**
 * Callback do OAuth do Google Drive.
 * Troca o code por tokens, grava-os cifrados e faz find-or-create da pasta
 * raiz "Projetos Flow".
 */
import { createHmac, timingSafeEqual } from "crypto"
import { redirect } from "next/navigation"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { encrypt } from "@/lib/utils/encryption"
import { ensureRootFolder, exchangeCodeForTokens } from "@/lib/google/drive"

export const runtime = "nodejs"

function verifyState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString()
    const lastColon = decoded.lastIndexOf(":")
    const payload = decoded.slice(0, lastColon)
    const sig = decoded.slice(lastColon + 1)
    const expected = createHmac("sha256", process.env.ENCRYPTION_KEY!).update(payload).digest("hex")
    if (sig.length !== expected.length) return null
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const colonIdx = payload.indexOf(":")
    const tenantId = payload.slice(0, colonIdx)
    const timestamp = Number(payload.slice(colonIdx + 1))
    if (Date.now() - timestamp > 600_000) return null // expira em 10 min
    return tenantId
  } catch {
    return null
  }
}

const DESTINO = "/configuracoes/integracoes"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const erro = searchParams.get("error")

  if (erro || !code || !state) redirect(`${DESTINO}?drive=error&reason=cancelled`)

  const tenantId = verifyState(state!)
  if (!tenantId) redirect(`${DESTINO}?drive=error&reason=state`)

  let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>
  try {
    tokens = await exchangeCodeForTokens(code!)
  } catch {
    redirect(`${DESTINO}?drive=error&reason=token_exchange`)
  }

  const sb = createAdminClient() as unknown as SupabaseClient
  const agora = new Date().toISOString()
  const expiry = new Date(Date.now() + (tokens!.expires_in ?? 3600) * 1000).toISOString()

  const registo: Record<string, unknown> = {
    tenant_id: tenantId!,
    access_token_encrypted: encrypt(tokens!.access_token),
    token_expiry: expiry,
    scope: tokens!.scope ?? null,
    connected_at: agora,
    sync_error: null,
    updated_at: agora,
  }
  // O Google so' devolve refresh_token no primeiro consentimento. Se nao vier,
  // preservamos o que ja' esta' guardado (nao sobrepor com null).
  if (tokens!.refresh_token) {
    registo.refresh_token_encrypted = encrypt(tokens!.refresh_token)
  }

  const { error } = await sb
    .from("google_drive_integrations")
    .upsert(registo, { onConflict: "tenant_id" })

  if (error) redirect(`${DESTINO}?drive=error&reason=db`)

  // Find-or-create da pasta raiz. Se falhar, a ligacao fica feita na mesma e a
  // pasta e' criada no primeiro uso.
  try {
    await ensureRootFolder(tenantId!, tokens!.access_token)
  } catch {
    redirect(`${DESTINO}?drive=connected&folder=pendente`)
  }

  redirect(`${DESTINO}?drive=connected`)
}
