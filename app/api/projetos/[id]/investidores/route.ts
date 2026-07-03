import { NextRequest } from "next/server"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"
import { z } from "zod"

const LinkSchema = z.object({
  investidor_id: z.string().uuid("UUID inválido"),
  percentagem: z.number().min(0.01).max(100),
})

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

  // Verify project belongs to tenant
  const { data: proj } = await supabase
    .from("projects")
    .select("id")
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()
  if (!proj) return jsonError("Projeto não encontrado", 404)

  // Verify investor belongs to tenant
  const { data: inv } = await supabase
    .from("investidores")
    .select("id")
    .eq("id", parsed.data.investidor_id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()
  if (!inv) return jsonError("Investidor não encontrado", 404)

  const { error } = await supabase.from("projeto_investidores").insert({
    projeto_id: params.id,
    investidor_id: parsed.data.investidor_id,
    percentagem: parsed.data.percentagem,
  })

  if (error) {
    if (error.code === "23505") return jsonError("Investidor já associado a este projeto", 409)
    return jsonError("Erro ao associar", 500)
  }

  return Response.json({ ok: true }, { status: 201 })
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
  const { error } = await supabase
    .from("projeto_investidores")
    .delete()
    .eq("projeto_id", params.id)
    .eq("investidor_id", investidorId)

  if (error) return jsonError("Erro ao remover", 500)

  return Response.json({ ok: true })
}
