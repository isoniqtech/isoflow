/**
 * Tarefas (planeamento) de um projeto.
 * GET  - lista (filtrada para investidor)
 * POST - cria uma tarefa manualmente
 */
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { TASK_STATUSES } from "@/lib/claude/generate-plan"

export const runtime = "nodejs"

function admin(): SupabaseClient {
  // Cast: tabela da migration 044, ainda nao esta' em types/supabase.ts
  return createAdminClient() as unknown as SupabaseClient
}

const CAMPOS =
  "id, title, description, start_date, end_date, status, visibility, sort_order, created_at"

async function investidorTemAcesso(userId: string, projectId: string): Promise<boolean> {
  const { getInvestidorProjectIds } = await import("@/lib/queries/investidores")
  return (await getInvestidorProjectIds(userId)).includes(projectId)
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "projetos", "view_own")) return jsonError("Forbidden", 403)

  const ehInvestidor = ctx.role === "investidor"
  if (ehInvestidor && !(await investidorTemAcesso(ctx.userId, params.id))) {
    return jsonError("Forbidden", 403)
  }

  let q = admin()
    .from("project_tasks")
    .select(CAMPOS)
    .eq("tenant_id", ctx.tenantId)
    .eq("project_id", params.id)
    .order("sort_order", { ascending: true })
    .order("start_date", { ascending: true, nullsFirst: false })

  // Reforco na API do que a RLS ja' garante
  if (ehInvestidor) q = q.eq("visibility", "todos")

  const { data, error } = await q
  if (error) return jsonError("Database error", 500, error.message)

  return Response.json({ tarefas: data ?? [] })
}

const criarSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  start_date: z.string().date().nullable().optional(),
  end_date: z.string().date().nullable().optional(),
  status: z.enum(TASK_STATUSES).default("por_iniciar"),
  visibility: z.enum(["admin", "todos"]).default("todos"),
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
  const parsed = criarSchema.safeParse(body)
  if (!parsed.success) return jsonError("Validation error", 400, parsed.error.flatten())

  const sb = admin()

  // Projeto tem de ser deste tenant
  const { data: projeto } = await sb
    .from("projects")
    .select("id")
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()
  if (!projeto) return jsonError("Projeto não encontrado", 404)

  // Colocar no fim da lista
  const { data: ultima } = await sb
    .from("project_tasks")
    .select("sort_order")
    .eq("project_id", params.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const proximaOrdem = ((ultima as { sort_order?: number } | null)?.sort_order ?? -1) + 1

  const { data, error } = await sb
    .from("project_tasks")
    .insert({
      tenant_id: ctx.tenantId,
      project_id: params.id,
      ...parsed.data,
      sort_order: proximaOrdem,
      created_by: ctx.userId,
    })
    .select(CAMPOS)
    .single()

  if (error) return jsonError("Database error", 500, error.message)
  return Response.json({ tarefa: data }, { status: 201 })
}
