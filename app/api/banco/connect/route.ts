import { randomBytes } from "crypto"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { buildTinkLinkUrl } from "@/lib/banking/tink"

/**
 * Inicia o flow OAuth do Tink. Devolve a URL para a qual o cliente deve
 * redirecionar o utilizador. O `state` codifica tenant_id + user_id +
 * nonce e é validado no callback (CSRF + atribuição de tenant).
 */
export async function POST(req: Request) {
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

  // Permitir ?market=SE&locale=sv_SE para testar com Tink Demobank (sueco).
  // Default PT/pt_PT para uso real com bancos portugueses.
  const url = new URL(req.url)
  const market = url.searchParams.get("market") ?? "PT"
  const locale = url.searchParams.get("locale") ?? (market === "SE" ? "sv_SE" : "pt_PT")

  const redirectUri = `${appUrl.replace(/\/$/, "")}/api/banking/callback`
  const nonce = randomBytes(16).toString("hex")
  const state = `${ctx.tenantId}.${ctx.userId}.${nonce}`

  const tinkUrl = buildTinkLinkUrl({ redirectUri, state, market, locale })

  return Response.json({ data: { url: tinkUrl } })
}
