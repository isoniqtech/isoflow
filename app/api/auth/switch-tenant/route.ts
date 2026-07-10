import { z } from "zod"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { jsonError } from "@/lib/api/auth"

const schema = z.object({
  tenant_id: z.string().uuid(),
})

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return jsonError("Unauthorized", 401)

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return jsonError("Invalid input", 400)

  const { tenant_id } = parsed.data
  const admin = createAdminClient()

  // Verificar que o utilizador tem acesso a este tenant
  const { data: primaryUser } = await admin
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle()

  const isPrimary = primaryUser?.tenant_id === tenant_id

  if (!isPrimary) {
    const { data: membership } = await admin
      .from("tenant_memberships")
      .select("status")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .eq("status", "active")
      .maybeSingle()

    if (!membership) return jsonError("Sem acesso a este tenant", 403)
  }

  // Actualizar app_metadata com o tenant activo
  // Se for o tenant primario, limpar o override (usa o default)
  const active_tenant_id = isPrimary ? null : tenant_id
  await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { active_tenant_id },
  })

  return NextResponse.json({ ok: true })
}
