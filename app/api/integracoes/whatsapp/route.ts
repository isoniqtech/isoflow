import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"

const Schema = z.object({
  action: z.enum(["activate", "deactivate"]),
})

export async function POST(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "edit")) {
    return jsonError("Forbidden", 403)
  }

  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return jsonError("Parametros invalidos", 400)

  const admin = createAdminClient()
  const isActive = parsed.data.action === "activate"

  const { error } = await admin
    .from("tenant_integrations")
    .upsert(
      {
        tenant_id: ctx.tenantId,
        type: "whatsapp",
        provider: "twilio",
        is_active: isActive,
        config: {},
      },
      { onConflict: "tenant_id,type,provider" },
    )

  if (error) return jsonError(error.message, 500)

  return Response.json({ ok: true, is_active: isActive })
}
