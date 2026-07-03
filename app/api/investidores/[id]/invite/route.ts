import { NextRequest } from "next/server"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hasPermission } from "@/lib/utils/permissions"

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Não autenticado", 401)
  if (!hasPermission(ctx.role, "investidores", "edit")) return jsonError("Sem permissão", 403)

  const supabase = createClient()

  const { data: inv } = await supabase
    .from("investidores")
    .select("id, email, nome, user_id, tenant_id")
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()

  if (!inv) return jsonError("Investidor não encontrado", 404)
  if (inv.user_id) return jsonError("Investidor já tem acesso", 409)

  const admin = createAdminClient()

  const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    inv.email,
    {
      data: {
        tenant_id: ctx.tenantId,
        role: "investidor",
        name: inv.nome,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    },
  )

  if (inviteError) {
    if (inviteError.message.includes("already registered")) {
      const { data: existingUser } = await admin.auth.admin.listUsers()
      const existing = existingUser?.users?.find((u) => u.email === inv.email)
      if (!existing) return jsonError("Erro ao enviar convite", 500)

      const { error: insertError } = await supabase.from("users").upsert({
        id: existing.id,
        tenant_id: ctx.tenantId,
        name: inv.nome,
        email: inv.email,
        role: "investidor",
        is_active: true,
      })
      if (insertError) return jsonError("Erro ao associar utilizador", 500)

      await supabase
        .from("investidores")
        .update({ user_id: existing.id })
        .eq("id", inv.id)

      return Response.json({ ok: true, user_id: existing.id })
    }
    return jsonError("Erro ao enviar convite", 500)
  }

  if (invite?.user) {
    await supabase.from("users").upsert({
      id: invite.user.id,
      tenant_id: ctx.tenantId,
      name: inv.nome,
      email: inv.email,
      role: "investidor",
      is_active: true,
    })

    await supabase
      .from("investidores")
      .update({ user_id: invite.user.id })
      .eq("id", inv.id)

    return Response.json({ ok: true, user_id: invite.user.id })
  }

  return jsonError("Erro inesperado", 500)
}
