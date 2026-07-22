/**
 * Gera o cronograma do projeto com IA e insere as tarefas.
 *
 * Usa a chave e o modelo Anthropic do tenant (resolveAnthropicConfig), tal
 * como a extração de faturas.
 *
 * ?substituir=1 apaga as tarefas existentes antes de inserir (usado no
 * "voltar a gerar"); por defeito acrescenta ao que já existe.
 */
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveAnthropicConfig } from "@/lib/claude/extract-invoice"
import { generateProjectPlan } from "@/lib/claude/generate-plan"
import { log } from "@/lib/utils/audit"

export const runtime = "nodejs"
export const maxDuration = 120

const CAMPOS =
  "id, title, description, start_date, end_date, status, visibility, sort_order, phase, phase_order, created_at"

const bodySchema = z.object({
  descricao: z.string().trim().min(3).max(5000),
  substituir: z.boolean().optional(),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (ctx.role === "investidor" || !hasPermission(ctx.role, "projetos", "edit")) {
    return jsonError("Forbidden", 403)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError("Invalid JSON", 400)
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return jsonError("Descreve o que queres planear", 400)

  // Cast: tabela da migration 044, ainda nao esta' em types/supabase.ts
  const sb = createAdminClient() as unknown as SupabaseClient

  const { data: projeto } = await sb
    .from("projects")
    .select("id, name, type, description, start_date, end_date")
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()
  if (!projeto) return jsonError("Projeto não encontrado", 404)

  const p = projeto as {
    id: string
    name: string
    type: string | null
    description: string | null
    start_date: string | null
    end_date: string | null
  }

  let tarefas
  try {
    const aiConfig = await resolveAnthropicConfig(ctx.tenantId, sb)
    tarefas = await generateProjectPlan(
      parsed.data.descricao,
      {
        nome: p.name,
        tipo: p.type,
        descricao: p.description,
        start_date: p.start_date,
        end_date: p.end_date,
      },
      aiConfig,
    )
  } catch (e) {
    return jsonError(
      e instanceof Error ? e.message : "A IA não conseguiu gerar o cronograma",
      502,
    )
  }

  if (tarefas.length === 0) {
    return jsonError(
      "A IA não devolveu tarefas aproveitáveis. Tenta descrever com mais detalhe.",
      422,
    )
  }

  if (parsed.data.substituir) {
    await sb.from("project_tasks").delete().eq("project_id", p.id).eq("tenant_id", ctx.tenantId)
  }

  // Continuar a numeracao se estivermos a acrescentar
  const { data: ultima } = await sb
    .from("project_tasks")
    .select("sort_order")
    .eq("project_id", p.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const base = ((ultima as { sort_order?: number } | null)?.sort_order ?? -1) + 1

  const { data, error } = await sb
    .from("project_tasks")
    .insert(
      tarefas.map((t, i) => ({
        tenant_id: ctx.tenantId,
        project_id: p.id,
        title: t.title,
        description: t.description,
        start_date: t.start_date,
        end_date: t.end_date,
        status: t.status,
        phase: t.phase,
        phase_order: t.phase_order,
        visibility: "todos", // default pedido; editavel por tarefa
        sort_order: base + i,
        created_by: ctx.userId,
      })),
    )
    .select(CAMPOS)

  if (error) return jsonError("Database error", 500, error.message)

  await log(sb, {
    action: "project_plan.generated",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "project",
    resourceId: p.id,
    metadata: { tarefas: tarefas.length, substituir: Boolean(parsed.data.substituir) },
  })

  return Response.json({ tarefas: data ?? [] }, { status: 201 })
}
