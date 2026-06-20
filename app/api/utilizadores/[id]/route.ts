import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"

const patchSchema = z.object({
  role: z.enum(["admin", "accountant", "member"]).optional(),
  is_active: z.boolean().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "utilizadores", "edit")) {
    return jsonError("Forbidden", 403)
  }
  if (params.id === ctx.userId) return jsonError("Nao podes editar o teu proprio perfil", 400)

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return jsonError("Invalid input", 400, parsed.error.flatten())

  const supabase = createClient()

  const { data: target } = await supabase
    .from("users")
    .select("id, role, tenant_id")
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()

  if (!target) return jsonError("Utilizador nao encontrado", 404)
  if (target.role === "owner" && parsed.data.role) {
    const { count } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("role", "owner")
    if ((count ?? 0) <= 1) return jsonError("Nao podes remover o unico owner", 400)
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from("users")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)

  if (error) return jsonError("Erro ao atualizar", 500, error.message)

  return Response.json({ success: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "utilizadores", "edit")) {
    return jsonError("Forbidden", 403)
  }
  if (params.id === ctx.userId) return jsonError("Nao podes remover a tua propria conta", 400)

  const supabase = createClient()
  const { data: target } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()

  if (!target) return jsonError("Utilizador nao encontrado", 404)
  if (target.role === "owner") return jsonError("Nao podes remover um owner", 400)

  const admin = createAdminClient()
  const { error } = await admin
    .from("users")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)

  if (error) return jsonError("Erro ao desativar", 500, error.message)

  return Response.json({ success: true })
}
