import { createClient } from "@/lib/supabase/server"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { runAutoReconciliation } from "@/lib/banking/reconciliation"
import { log } from "@/lib/utils/audit"

export async function POST() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "conciliacao", "create")) {
    return jsonError("Forbidden", 403)
  }

  const supabase = createClient()

  try {
    const result = await runAutoReconciliation(supabase, ctx.tenantId)
    await log(supabase, {
      action: "reconciliation.auto_run",
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      metadata: result as unknown as Record<string, unknown>,
    })
    return Response.json({ data: result })
  } catch (e) {
    console.error("auto reconciliation failed:", e)
    return jsonError(
      "Falha ao correr conciliação automática",
      500,
      e instanceof Error ? e.message : String(e),
    )
  }
}
