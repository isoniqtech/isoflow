import { z } from "zod"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"

const UpdateSchema = z.object({
  capital_disponivel: z.number().min(0).optional(),
  tipo_negocio: z.array(z.enum(["terreno", "casa", "edificio"])).optional(),
  estado: z.enum(["pronto_para_investir", "em_investimento", "nao_disponivel"]).optional(),
  notas: z.string().max(2000).nullable().optional(),
})

// Tipo minimo para operacoes em tabelas sem tipos gerados
type UntypedClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
      }
    }
    update: (data: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>
    }
  }
}

export async function GET() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Não autenticado", 401)
  if (!hasPermission(ctx.role, "investidor_perfil", "view_all")) return jsonError("Sem permissão", 403)

  const supabase = createClient()
  const raw = supabase as unknown as UntypedClient

  const { data, error } = await raw.from("investidores")
    .select("id, nome, email, estado, capital_disponivel, tipo_negocio, notas")
    .eq("user_id", ctx.userId)
    .maybeSingle()

  if (error) return jsonError("Erro ao carregar perfil", 500)
  if (!data) return jsonError("Perfil de investidor não encontrado", 404)

  // Calcular capital alocado em projetos
  const { data: links } = await supabase
    .from("projeto_investidores" as "project_members")
    .select("valor_alocado")
    .eq("investidor_id" as "project_id", data.id as string)

  const capitalAlocado = (links ?? []).reduce(
    (s, l) => s + Number((l as unknown as { valor_alocado: number | null }).valor_alocado ?? 0),
    0,
  )

  return Response.json({ ...data, capital_alocado: capitalAlocado })
}

export async function PATCH(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Não autenticado", 401)
  if (!hasPermission(ctx.role, "investidor_perfil", "edit")) return jsonError("Sem permissão", 403)

  const body = await req.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return jsonError("Dados inválidos", 400, parsed.error.flatten())

  const supabase = createClient()
  const raw = supabase as unknown as UntypedClient

  // Encontrar o registo do investidor pelo user_id
  const { data: inv } = await raw.from("investidores")
    .select("id")
    .eq("user_id", ctx.userId)
    .maybeSingle()

  if (!inv) return jsonError("Perfil de investidor não encontrado", 404)

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.capital_disponivel !== undefined) updates.capital_disponivel = parsed.data.capital_disponivel
  if (parsed.data.tipo_negocio !== undefined) updates.tipo_negocio = parsed.data.tipo_negocio
  if (parsed.data.estado !== undefined) updates.estado = parsed.data.estado
  if (parsed.data.notas !== undefined) updates.notas = parsed.data.notas

  const { error } = await raw.from("investidores")
    .update(updates)
    .eq("id", inv.id as string)

  if (error) return jsonError("Erro ao atualizar perfil", 500)

  return Response.json({ ok: true })
}
