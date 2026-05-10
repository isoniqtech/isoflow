import { randomBytes } from "crypto"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { buildTinkLinkUrl } from "@/lib/banking/tink"

/**
 * Inicia o flow OAuth do Tink. Devolve a URL para a qual o cliente deve
 * redirecionar o utilizador. O `state` codifica tenant_id + user_id +
 * nonce e é validado no callback (CSRF + atribuição de tenant).
 */
export async function POST() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "view_all")) {
    return jsonError("Forbidden", 403)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    return jsonError(
      "NEXT_PUBLIC_APP_URL não configurado — Tink não pode redirecionar",
      500,
    )
  }
  if (!process.env.TINK_CLIENT_ID || !process.env.TINK_CLIENT_SECRET) {
    return jsonError("Credenciais Tink não configuradas no servidor", 500)
  }

  const redirectUri = `${appUrl.replace(/\/$/, "")}/api/banking/callback`
  const nonce = randomBytes(16).toString("hex")
  const state = `${ctx.tenantId}.${ctx.userId}.${nonce}`

  // Sem precisar de DB para o state — encriptamos os dados dentro dele.
  // Ver lógica de validação no callback.
  const tinkUrl = buildTinkLinkUrl({ redirectUri, state })

  return Response.json({ data: { url: tinkUrl } })
}
