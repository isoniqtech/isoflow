import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { jsonError } from "@/lib/api/auth"

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return jsonError("Unauthorized", 401)

  const admin = createAdminClient()
  const { error } = await admin
    .from("users")
    .update({ is_active: true })
    .eq("id", user.id)

  if (error) return jsonError("Erro ao activar utilizador", 500, error.message)

  return Response.json({ ok: true })
}
