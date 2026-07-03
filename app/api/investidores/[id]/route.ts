import { NextRequest } from "next/server"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"
import { getInvestidorDetail } from "@/lib/queries/investidores"
import { z } from "zod"

const UpdateSchema = z.object({
  nome: z.string().min(2).optional(),
  email: z.string().email().optional(),
  estado: z.enum(["pronto_para_investir", "em_investimento", "nao_disponivel"]).optional(),
  capital_disponivel: z.number().min(0).optional(),
  tipo_negocio: z.array(z.enum(["terreno", "casa", "edificio"])).optional(),
  notas: z.string().nullable().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Não autenticado", 401)
  if (!hasPermission(ctx.role, "investidores", "view_all")) return jsonError("Sem permissão", 403)

  const data = await getInvestidorDetail(params.id, ctx.tenantId)
  if (!data) return jsonError("Não encontrado", 404)

  return Response.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Não autenticado", 401)
  if (!hasPermission(ctx.role, "investidores", "edit")) return jsonError("Sem permissão", 403)

  const body = await req.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return jsonError("Dados inválidos", 400, parsed.error.flatten())

  const supabase = createClient()
  const { error } = await supabase
    .from("investidores")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)

  if (error) return jsonError("Erro ao atualizar", 500)

  return Response.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Não autenticado", 401)
  if (!hasPermission(ctx.role, "investidores", "delete")) return jsonError("Sem permissão", 403)

  const supabase = createClient()
  const { error } = await supabase
    .from("investidores")
    .delete()
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)

  if (error) return jsonError("Erro ao eliminar", 500)

  return Response.json({ ok: true })
}
