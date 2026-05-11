import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { forwardInvoiceToN8N } from "@/lib/webhooks/n8n"
import { log } from "@/lib/utils/audit"

export const runtime = "nodejs"

/**
 * Re-envia uma fatura específica para o webhook n8n configurado.
 * Útil quando a primeira tentativa falhou (n8n down, etc) ou quando
 * o user quer forçar reenvio depois de editar a fatura.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "faturas", "edit")) {
    return jsonError("Forbidden", 403)
  }

  const admin = createAdminClient()
  const result = await forwardInvoiceToN8N(admin, params.id, ctx.tenantId)

  await log(admin, {
    action: "invoice.erp_resend",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "invoice",
    resourceId: params.id,
    metadata: {
      ok: result.ok,
      status: result.status,
      skipped: result.skipped ?? false,
    },
  })

  if (result.skipped) {
    return jsonError("Sem integração ERP/n8n configurada", 400)
  }
  if (!result.ok) {
    return Response.json(
      { ok: false, status: result.status, error: result.error },
      { status: 502 },
    )
  }
  return Response.json({ ok: true, status: result.status })
}
