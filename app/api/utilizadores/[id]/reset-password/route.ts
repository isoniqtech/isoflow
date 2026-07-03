import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "utilizadores", "edit")) {
    return jsonError("Forbidden", 403)
  }
  if (params.id === ctx.userId) {
    return jsonError("Usa as definicoes do perfil para alterar a tua propria password", 400)
  }

  const supabase = createClient()
  const { data: target } = await supabase
    .from("users")
    .select("id, email")
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()

  if (!target) return jsonError("Utilizador nao encontrado", 404)

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: target.email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    },
  })

  if (error) return jsonError("Erro ao enviar email de reset", 500, error.message)

  return Response.json({ success: true })
}
