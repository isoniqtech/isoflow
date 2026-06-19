import { createAdminClient } from "@/lib/supabase/admin"
import { requireSuperAdmin } from "@/lib/api/admin-auth"
import { jsonError } from "@/lib/api/auth"
import { z } from "zod"

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(["owner", "admin", "accountant", "member"]),
  password: z.string().min(6),
})

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const adminId = await requireSuperAdmin()
  if (!adminId) return jsonError("Forbidden", 403)

  const admin = createAdminClient()

  const { data, error } = await admin
    .from("users")
    .select("id, name, email, role, is_active, created_at, last_login_at")
    .eq("tenant_id", params.id)
    .order("created_at", { ascending: true })

  if (error) return jsonError("Database error", 500, error.message)

  return Response.json(data ?? [])
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const adminId = await requireSuperAdmin()
  if (!adminId) return jsonError("Forbidden", 403)

  const body = await req.json().catch(() => null)
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) return jsonError("Invalid input", 400, parsed.error.flatten())

  const { email, name, role, password } = parsed.data
  const admin = createAdminClient()

  const { data: tenant } = await admin
    .from("tenants")
    .select("id")
    .eq("id", params.id)
    .maybeSingle()
  if (!tenant) return jsonError("Tenant not found", 404)

  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authErr || !authUser.user) {
    return jsonError("Failed to create auth user", 500, authErr?.message)
  }

  const { error: profileErr } = await admin.from("users").insert({
    id: authUser.user.id,
    tenant_id: params.id,
    name,
    email,
    role,
    is_active: true,
  })

  if (profileErr) {
    await admin.auth.admin.deleteUser(authUser.user.id)
    return jsonError("Failed to create user profile", 500, profileErr.message)
  }

  return Response.json({ id: authUser.user.id, email, name, role }, { status: 201 })
}
