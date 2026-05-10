import { z } from "zod"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { createAdminClient, isSuperAdmin } from "@/lib/supabase/admin"
import { log } from "@/lib/utils/audit"

const updateSchema = z
  .object({
    plan: z.enum(["starter", "business", "pro", "enterprise"]),
    status: z.enum(["trial", "active", "suspended", "cancelled"]),
  })
  .partial()

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!isSuperAdmin(ctx.userId)) return jsonError("Forbidden", 403)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError("Invalid JSON", 400)
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError("Validation error", 400, parsed.error.flatten())
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("tenants")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("id, name, plan, status")
    .maybeSingle()

  if (error) return jsonError("Could not update tenant", 500, error.message)
  if (!data) return jsonError("Not found", 404)

  await log(supabase, {
    action: "tenant.admin_updated",
    tenantId: params.id,
    userId: ctx.userId,
    resourceType: "tenant",
    resourceId: params.id,
    metadata: { changed_keys: Object.keys(parsed.data) },
  })

  return Response.json({ data })
}
