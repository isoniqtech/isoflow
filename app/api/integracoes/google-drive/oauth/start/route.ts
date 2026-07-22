/**
 * Inicia o OAuth do Google Drive para o tenant.
 * Devolve o redirect_url; o browser navega para lá.
 *
 * O `state` e' assinado com HMAC-SHA256 (ENCRYPTION_KEY) e tem validade de
 * 10 min - mesmo padrao do OAuth do TOConline.
 */
import { createHmac } from "crypto"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import {
  DRIVE_SCOPE,
  getDriveRedirectUri,
  getGoogleClientId,
  getGoogleClientSecret,
} from "@/lib/google/drive"

export const runtime = "nodejs"

function makeState(tenantId: string): string {
  const payload = `${tenantId}:${Date.now()}`
  const sig = createHmac("sha256", process.env.ENCRYPTION_KEY!).update(payload).digest("hex")
  return Buffer.from(`${payload}:${sig}`).toString("base64url")
}

export async function POST() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "edit")) return jsonError("Forbidden", 403)

  if (!getGoogleClientId() || !getGoogleClientSecret()) {
    return jsonError(
      "Google Drive não configurado: faltam GOOGLE_DRIVE_CLIENT_ID e GOOGLE_DRIVE_CLIENT_SECRET",
      503,
    )
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  url.searchParams.set("client_id", getGoogleClientId())
  url.searchParams.set("redirect_uri", getDriveRedirectUri())
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", DRIVE_SCOPE)
  // offline + consent garantem que recebemos refresh_token (o Google so' o
  // devolve no primeiro consentimento, salvo prompt=consent)
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("prompt", "consent")
  url.searchParams.set("include_granted_scopes", "true")
  url.searchParams.set("state", makeState(ctx.tenantId))

  return Response.json({ redirect_url: url.toString() })
}
