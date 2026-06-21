import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(["owner", "admin", "accountant", "member"]),
})

export async function POST(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "utilizadores", "edit")) {
    return jsonError("Forbidden", 403)
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return jsonError("Invalid input", 400, parsed.error.flatten())

  const { name, email, role } = parsed.data
  const admin = createAdminClient()

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? ""
  const proto = host.includes("localhost") ? "http" : "https"
  const redirectTo = `${proto}://${host}/reset-password`

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { name, tenant_id: ctx.tenantId, role },
  })

  if (error) {
    console.error("[invite] inviteUserByEmail error:", error.message, error)
    return jsonError(error.message, 500, error.message)
  }

  const { error: profileErr } = await admin.from("users").upsert({
    id: data.user.id,
    tenant_id: ctx.tenantId,
    name,
    email,
    role,
    is_active: false,
  }, { onConflict: "id" })

  if (profileErr) {
    console.error("[invite] profile upsert error:", profileErr.message)
    await admin.auth.admin.deleteUser(data.user.id)
    return jsonError("Erro ao criar perfil", 500, profileErr.message)
  }

  return Response.json({ id: data.user.id, email, name, role }, { status: 201 })
}
