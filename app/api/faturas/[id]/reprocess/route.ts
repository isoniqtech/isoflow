import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { reprocessInvoice } from "@/lib/claude/reprocess-invoice"
import { log } from "@/lib/utils/audit"

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "faturas", "edit")) {
    return jsonError("Forbidden", 403)
  }

  const supabase = createClient()
  const admin = createAdminClient()

  const result = await reprocessInvoice(params.id, ctx.tenantId, supabase, admin)

  if (!result.ok) {
    return jsonError(result.error ?? "Reprocessamento falhou", 502)
  }

  await log(supabase, {
    action: "invoice.reprocessed",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "invoice",
    resourceId: params.id,
    metadata: { confidence: result.confidence, trigger: "manual" },
  })

  return Response.json({ ok: true, supplier_name: result.supplierName, confidence: result.confidence })
}
