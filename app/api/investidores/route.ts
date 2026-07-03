import { NextRequest } from "next/server"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"
import { listInvestidores, getInvestidorStats } from "@/lib/queries/investidores"
import { z } from "zod"

const CreateSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("Email inválido"),
  estado: z.enum(["pronto_para_investir", "em_investimento", "nao_disponivel"]).default("pronto_para_investir"),
  capital_disponivel: z.number().min(0).default(0),
  tipo_negocio: z.array(z.enum(["terreno", "casa", "edificio"])).default([]),
  notas: z.string().nullable().optional(),
})

export async function GET() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Não autenticado", 401)
  if (!hasPermission(ctx.role, "investidores", "view_all")) return jsonError("Sem permissão", 403)

  const [list, stats] = await Promise.all([
    listInvestidores(ctx.tenantId),
    getInvestidorStats(ctx.tenantId),
  ])

  return Response.json({ investidores: list, stats })
}

export async function POST(req: NextRequest) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Não autenticado", 401)
  if (!hasPermission(ctx.role, "investidores", "create")) return jsonError("Sem permissão", 403)

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return jsonError("Dados inválidos", 400, parsed.error.flatten())

  const supabase = createClient()
  const { data, error } = await supabase
    .from("investidores")
    .insert({
      tenant_id: ctx.tenantId,
      nome: parsed.data.nome,
      email: parsed.data.email,
      estado: parsed.data.estado,
      capital_disponivel: parsed.data.capital_disponivel,
      tipo_negocio: parsed.data.tipo_negocio,
      notas: parsed.data.notas ?? null,
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") return jsonError("Já existe um investidor com este email", 409)
    return jsonError("Erro ao criar investidor", 500)
  }

  return Response.json({ id: data.id }, { status: 201 })
}
