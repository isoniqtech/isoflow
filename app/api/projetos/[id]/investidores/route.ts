import { NextRequest } from "next/server"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"
import { z } from "zod"

const LinkSchema = z.object({
  investidor_id: z.string().uuid("UUID inválido"),
  percentagem: z.number().min(0.01).max(100),
})

type UntypedClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        eq: (col: string, val: unknown) => {
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>
        }
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>
        single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>
      }
      in: (col: string, vals: unknown[]) => Promise<{ data: Record<string, unknown>[] | null }>
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

  // Verify project belongs to tenant and get budget
  const { data: proj } = await raw
    .from("projects")
    .select("id, budget")
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()
  if (!proj) return jsonError("Projeto não encontrado", 404)

  // Verify investor belongs to tenant and get capital
  const { data: inv } = await raw
    .from("investidores")
    .select("id, capital_disponivel")
    .eq("id", parsed.data.investidor_id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()
  if (!inv) return jsonError("Investidor não encontrado", 404)

  const budget = inv !== null && proj.budget !== null ? Number(proj.budget) : null
  const capitalDisponivel = Number(inv.capital_disponivel ?? 0)
  let valorAlocado: number | null = null

  if (budget !== null) {
    valorAlocado = Math.round((budget * parsed.data.percentagem) / 100 * 100) / 100

    // Validar que nao excede o capital disponivel
    if (capitalDisponivel > 0 && valorAlocado > capitalDisponivel) {
      return jsonError(
        `Valor alocado (${valorAlocado}€) excede o capital disponível do investidor (${capitalDisponivel}€)`,
        422,
      )
    }
  }

  // Inserir registo
  const { error: insertErr } = await raw.from("projeto_investidores").insert({
    projeto_id: params.id,
    investidor_id: parsed.data.investidor_id,
    percentagem: parsed.data.percentagem,
    ...(valorAlocado !== null ? { valor_alocado: valorAlocado } : {}),
  })

  if (insertErr) {
    const err = insertErr as { code?: string; message: string }
    if (err.code === "23505") return jsonError("Investidor já associado a este projeto", 409)
    return jsonError("Erro ao associar", 500)
  }

  // Subtrair do capital disponivel se houver valor alocado
  if (valorAlocado !== null && capitalDisponivel > 0) {
    const novoCapital = Math.max(0, capitalDisponivel - valorAlocado)
    await raw.from("investidores")
      .update({ capital_disponivel: novoCapital, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.investidor_id)
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

  // Buscar o registo para saber o valor_alocado antes de apagar
  const { data: link } = await raw
    .from("projeto_investidores")
    .select("valor_alocado")
    .eq("projeto_id", params.id)
    .eq("investidor_id", investidorId)
    .maybeSingle()

  const { error } = await raw
    .from("projeto_investidores")
    .delete()
    .eq("projeto_id", params.id)
    .eq("investidor_id", investidorId)

  if (error) return jsonError("Erro ao remover", 500)

  // Restaurar capital disponivel se havia valor alocado
  const valorAlocado = link ? Number((link as Record<string, unknown>).valor_alocado ?? 0) : 0
  if (valorAlocado > 0) {
    const { data: inv } = await raw
      .from("investidores")
      .select("capital_disponivel")
      .eq("id", investidorId)
      .maybeSingle()

    if (inv) {
      const novoCapital = Number((inv as Record<string, unknown>).capital_disponivel ?? 0) + valorAlocado
      await raw.from("investidores")
        .update({ capital_disponivel: novoCapital, updated_at: new Date().toISOString() })
        .eq("id", investidorId)
    }
  }

  return Response.json({ ok: true })
}
