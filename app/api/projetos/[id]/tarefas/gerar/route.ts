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
  "id, title, description, start_date, end_date, status, visibility, sort_order, phase, phase_order, parent_id, progress, created_at"

const bodySchema = z.object({
  descricao: z.string().trim().min(3).max(5000),
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

  // O que ja' existe: serve para a IA nao repetir e para encaixar as fases
  // novas a seguir as atuais, sem colidir com a numeracao delas.
  const { data: atuais } = await sb
    .from("project_tasks")
    .select("title, phase, phase_order")
    .eq("project_id", p.id)
    .eq("tenant_id", ctx.tenantId)
    .order("phase_order", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true })

  const existentes = (atuais ?? []) as {
    title: string
    phase: string | null
    phase_order: number | null
  }[]

  // Fase -> ordem que ja' tem. Reaproveitar evita que "Fase 1" apareca duas
  // vezes no Gantt quando a IA volta a nomea-la.
  const ordemPorFase = new Map<string, number>()
  let maiorOrdem = -1
  for (const t of existentes) {
    if (t.phase && t.phase_order !== null) {
      if (!ordemPorFase.has(t.phase)) ordemPorFase.set(t.phase, t.phase_order)
      maiorOrdem = Math.max(maiorOrdem, t.phase_order)
    }
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
      { fases: [...ordemPorFase.keys()], titulos: existentes.map((t) => t.title) },
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

  // A geracao NUNCA apaga: acrescenta sempre ao que ja' esta'. Perder um plano
  // ajustado a mao por causa de um clique num botao nao e' um risco aceitavel.
  // A phase_order que a IA devolve (0, 1, 2...) colidiria com as fases atuais,
  // por isso as fases novas entram a seguir a maior ordem que ja' existe.
  let proximaOrdemFase = maiorOrdem + 1
  for (const t of tarefas) {
    if (!t.phase) continue
    let ordem = ordemPorFase.get(t.phase)
    if (ordem === undefined) {
      ordem = proximaOrdemFase++
      ordemPorFase.set(t.phase, ordem)
    }
    t.phase_order = ordem
  }

  // Continuar a numeracao das tarefas
  const { data: ultima } = await sb
    .from("project_tasks")
    .select("sort_order")
    .eq("project_id", p.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const base = ((ultima as { sort_order?: number } | null)?.sort_order ?? -1) + 1

  // Dois passos: as tarefas macro primeiro, para as subtarefas terem parent_id.
  // O sort_order avanca em ordem de leitura (macro, as suas subtarefas, macro
  // seguinte...), por isso deixamos espaco para os filhos de cada macro.
  const comum = {
    tenant_id: ctx.tenantId,
    project_id: p.id,
    visibility: "todos", // default pedido; editavel por tarefa
    created_by: ctx.userId,
  }

  let ordem = base
  const ordemMacro: number[] = []
  for (const t of tarefas) {
    ordemMacro.push(ordem)
    ordem += 1 + t.subtarefas.length
  }

  const { data: macros, error } = await sb
    .from("project_tasks")
    .insert(
      tarefas.map((t, i) => ({
        ...comum,
        title: t.title,
        description: t.description,
        start_date: t.start_date,
        end_date: t.end_date,
        status: t.status,
        phase: t.phase,
        phase_order: t.phase_order,
        sort_order: ordemMacro[i],
      })),
    )
    .select("id, sort_order")

  if (error) return jsonError("Database error", 500, error.message)

  // O insert nao garante a ordem do retorno: casar pelo sort_order, que e' unico
  // dentro deste lote.
  const idPorOrdem = new Map(
    ((macros ?? []) as { id: string; sort_order: number }[]).map((m) => [m.sort_order, m.id]),
  )

  const subtarefas = tarefas.flatMap((t, i) => {
    const parentId = idPorOrdem.get(ordemMacro[i])
    if (!parentId) return []
    return t.subtarefas.map((s, j) => ({
      ...comum,
      parent_id: parentId,
      title: s.title,
      description: s.description,
      start_date: s.start_date,
      end_date: s.end_date,
      status: s.status,
      // Herdam a fase da macro, para o agrupamento do Gantt ser coerente
      phase: t.phase,
      phase_order: t.phase_order,
      sort_order: ordemMacro[i] + 1 + j,
    }))
  })

  if (subtarefas.length > 0) {
    const { error: erroSub } = await sb.from("project_tasks").insert(subtarefas)
    // Falhar aqui nao deita fora as macro ja' inseridas: o plano fica utilizavel
    // e o utilizador pode acrescentar os passos a mao.
    if (erroSub) return jsonError("Database error", 500, erroSub.message)
  }

  const { data } = await sb
    .from("project_tasks")
    .select(CAMPOS)
    .eq("project_id", p.id)
    .eq("tenant_id", ctx.tenantId)
    .order("phase_order", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true })

  await log(sb, {
    action: "project_plan.generated",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "project",
    resourceId: p.id,
    metadata: {
      tarefas: tarefas.length,
      subtarefas: subtarefas.length,
      ja_existiam: existentes.length,
    },
  })

  return Response.json({ tarefas: data ?? [] }, { status: 201 })
}
