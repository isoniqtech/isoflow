import { NextRequest } from "next/server"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"
import { z } from "zod"

const LinkSchema = z.object({
  investidor_id: z.string().uuid("UUID inválido"),
  percentagem: z.number().min(0.01).max(100),
  valor_euro: z.number().positive().optional(),
})

type UntypedClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        eq: (col: string, val: unknown) => {
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>
        }
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>
      }
    }
    insert: (data: Record<string, unknown>) => Promise<{ error: { code?: string; message: string } | null }>
    update: (data: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>
    }
    delete: () => {
      eq: (col: string, val: unknown) => {
        eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>
      }
    }
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Não autenticado", 401)
  if (!hasPermission(ctx.role, "investidores", "edit")) return jsonError("Sem permissão", 403)

  const body = await req.json().catch(() => null)
  const parsed = LinkSchema.safeParse(body)
  if (!parsed.success) return jsonError("Dados inválidos", 400, parsed.error.flatten())

  const supabase = createClient()
  const raw = supabase as unknown as UntypedClient

  // Verificar projeto e obter orçamento
  const { data: proj } = await raw
    .from("projects")
    .select("id, budget")
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()
  if (!proj) return jsonError("Projeto não encontrado", 404)

  // Verificar investidor e obter capital
  const { data: inv } = await raw
    .from("investidores")
    .select("id, capital_disponivel")
    .eq("id", parsed.data.investidor_id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()
  if (!inv) return jsonError("Investidor não encontrado", 404)

  const budget = proj.budget !== null ? Number(proj.budget) : null
  const capitalDisponivel = Number(inv.capital_disponivel ?? 0)

  // Calcular valor em euros: usar valor_euro exato se fornecido (modo €), senao calcular de percentagem
  let valorAlocado: number | null = null
  if (parsed.data.valor_euro !== undefined) {
    valorAlocado = Math.round(parsed.data.valor_euro * 100) / 100
  } else if (budget !== null) {
    valorAlocado = Math.round((budget * parsed.data.percentagem) / 100 * 100) / 100
  }

  if (valorAlocado !== null && capitalDisponivel > 0 && valorAlocado > capitalDisponivel) {
    return jsonError(
      `Valor alocado (${valorAlocado}€) excede o capital disponivel (${capitalDisponivel}€)`,
      422,
    )
  }

  // Inserir sem valor_alocado (coluna opcional de migration 036)
  const { error: insertErr } = await raw.from("projeto_investidores").insert({
    projeto_id: params.id,
    investidor_id: parsed.data.investidor_id,
    percentagem: parsed.data.percentagem,
  })

  if (insertErr) {
    console.error("[projetos/investidores POST] insert error:", insertErr)
    const err = insertErr as { code?: string; message: string }
    if (err.code === "23505") return jsonError("Investidor já associado a este projeto", 409)
    return jsonError("Erro ao associar", 500, err.message)
  }

  // Subtrair do capital disponivel
  if (valorAlocado !== null && capitalDisponivel > 0) {
    const novoCapital = Math.max(0, capitalDisponivel - valorAlocado)
    const { error: updErr } = await raw.from("investidores")
      .update({ capital_disponivel: novoCapital, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.investidor_id)
    if (updErr) console.error("[projetos/investidores POST] capital update error:", updErr)
  }

  return Response.json({ ok: true, valor_alocado: valorAlocado }, { status: 201 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Não autenticado", 401)
  if (!hasPermission(ctx.role, "investidores", "edit")) return jsonError("Sem permissão", 403)

  const { searchParams } = new URL(req.url)
  const investidorId = searchParams.get("investidor_id")
  if (!investidorId) return jsonError("investidor_id obrigatório", 400)

  const supabase = createClient()
  const raw = supabase as unknown as UntypedClient

  // Obter percentagem antes de apagar (para restaurar capital)
  const { data: link } = await raw
    .from("projeto_investidores")
    .select("percentagem")
    .eq("projeto_id", params.id)
    .eq("investidor_id", investidorId)
    .maybeSingle()

  const { error } = await raw
    .from("projeto_investidores")
    .delete()
    .eq("projeto_id", params.id)
    .eq("investidor_id", investidorId)

  if (error) return jsonError("Erro ao remover", 500)

  // Restaurar capital: recalcular a partir do orçamento atual do projeto
  if (link) {
    const percentagem = Number((link as Record<string, unknown>).percentagem ?? 0)
    if (percentagem > 0) {
      const { data: proj } = await raw
        .from("projects")
        .select("budget")
        .eq("id", params.id)
        .eq("tenant_id", ctx.tenantId)
        .maybeSingle()

      const budget = proj ? Number((proj as Record<string, unknown>).budget ?? 0) : 0
      const valorARestaurar = budget > 0 ? Math.round((budget * percentagem) / 100 * 100) / 100 : 0

      if (valorARestaurar > 0) {
        const { data: inv } = await raw
          .from("investidores")
          .select("capital_disponivel")
          .eq("id", investidorId)
          .maybeSingle()

        if (inv) {
          const novoCapital = Number((inv as Record<string, unknown>).capital_disponivel ?? 0) + valorARestaurar
          await raw.from("investidores")
            .update({ capital_disponivel: novoCapital, updated_at: new Date().toISOString() })
            .eq("id", investidorId)
        }
      }
    }
  }

  return Response.json({ ok: true })
}
