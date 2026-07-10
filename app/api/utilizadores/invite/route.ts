import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(["owner", "admin", "accountant", "member", "investidor"]),
  capital_disponivel: z.number().min(0).optional(),
  tipo_negocio: z.array(z.enum(["terreno", "casa", "edificio"])).optional(),
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

  const { name, email, role, capital_disponivel, tipo_negocio } = parsed.data
  const admin = createAdminClient()

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? ""
  const proto = host.includes("localhost") ? "http" : "https"
  const redirectTo = `${proto}://${host}/reset-password`

  // Verificar se o utilizador ja existe no Supabase Auth
  const { data: existingList } = await admin.auth.admin.listUsers()
  const existingAuthUser = existingList?.users?.find((u) => u.email === email)

  if (existingAuthUser) {
    // Utilizador ja existe - adicionar como membro do tenant actual
    const { error: memberErr } = await admin
      .from("tenant_memberships")
      .upsert({
        user_id: existingAuthUser.id,
        tenant_id: ctx.tenantId,
        role,
        invited_by: ctx.userId,
        joined_at: new Date().toISOString(),
        status: "active",
      }, { onConflict: "user_id,tenant_id" })

    if (memberErr) {
      console.error("[invite] membership upsert error:", memberErr.message)
      return jsonError("Erro ao adicionar membro: " + memberErr.message, 500)
    }

    return Response.json(
      { id: existingAuthUser.id, email, name, role, existing_user: true },
      { status: 201 },
    )
  }

  // Utilizador novo - criar via convite
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

  // Se for investidor, criar registo na tabela investidores
  // (cast necessario porque os tipos gerados ainda nao incluem a tabela investidores)
  if (role === "investidor") {
    type UntypedFrom = {
      from: (t: string) => {
        upsert: (
          data: Record<string, unknown>,
          opts?: Record<string, string>,
        ) => Promise<{ error: { message: string } | null }>
      }
    }
    const adminRaw = admin as unknown as UntypedFrom
    const { error: invErr } = await adminRaw.from("investidores").upsert({
      tenant_id: ctx.tenantId,
      user_id: data.user.id,
      nome: name,
      email,
      estado: "pronto_para_investir",
      capital_disponivel: capital_disponivel ?? 0,
      tipo_negocio: tipo_negocio ?? [],
    }, { onConflict: "tenant_id,email" })

    if (invErr) {
      console.error("[invite] investidor upsert error:", invErr.message)
      // Nao bloquear o convite por causa disto - pode corrigir manualmente
    }
  }

  return Response.json({ id: data.user.id, email, name, role }, { status: 201 })
}
