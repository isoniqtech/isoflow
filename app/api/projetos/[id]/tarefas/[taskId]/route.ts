/**
 * Editar e apagar uma tarefa do projeto.
 * Só quem gere projetos. O investidor nunca escreve.
 */
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { TASK_STATUSES } from "@/lib/claude/generate-plan"
import { resolverPhaseOrder, validarPai } from "@/lib/queries/project-tasks"

export const runtime = "nodejs"

const CAMPOS =
  "id, title, description, start_date, end_date, status, visibility, sort_order, phase, phase_order, parent_id, progress, created_at"

function admin(): SupabaseClient {
  // Cast: tabela da migration 044, ainda nao esta' em types/supabase.ts
  return createAdminClient() as unknown as SupabaseClient
}

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).nullable(),
    start_date: z.string().date().nullable(),
    end_date: z.string().date().nullable(),
    status: z.enum(TASK_STATUSES),
    visibility: z.enum(["admin", "todos"]),
    sort_order: z.number().int().min(0),
    phase: z.string().trim().max(120).nullable(),
    parent_id: z.string().uuid().nullable(),
    progress: z.number().int().min(0).max(100),
  })
  .partial()

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; taskId: string } },
) {
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
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return jsonError("Validation error", 400, parsed.error.flatten())

  const sb = admin()

  // Mudar de fase implica recalcular a ordem do grupo, senao a tarefa aparecia
  // no sitio certo da lista mas no grupo errado do Gantt.
  const campos: Record<string, unknown> = { ...parsed.data }
  if ("phase" in parsed.data) {
    const phase = parsed.data.phase?.trim() || null
    campos.phase = phase
    campos.phase_order = phase ? await resolverPhaseOrder(sb, params.id, phase) : null
  }

  if ("parent_id" in parsed.data && parsed.data.parent_id) {
    if (parsed.data.parent_id === params.taskId) {
      return jsonError("Uma tarefa não pode ser mãe de si própria", 400)
    }
    const pai = await validarPai(sb, params.id, parsed.data.parent_id)
    if (!pai) return jsonError("A tarefa-mãe não é válida", 400)
    // A fase do pai ganha sempre, mesmo que venha `phase` no mesmo pedido
    campos.phase = pai.phase
    campos.phase_order = pai.phase_order
  }

  const { data, error } = await sb
    .from("project_tasks")
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq("id", params.taskId)
    .eq("project_id", params.id)
    .eq("tenant_id", ctx.tenantId)
    .select(CAMPOS)
    .maybeSingle()

  if (error) return jsonError("Database error", 500, error.message)
  if (!data) return jsonError("Tarefa não encontrada", 404)

  return Response.json({ tarefa: data })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; taskId: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (ctx.role === "investidor" || !hasPermission(ctx.role, "projetos", "edit")) {
    return jsonError("Forbidden", 403)
  }

  const { error } = await admin()
    .from("project_tasks")
    .delete()
    .eq("id", params.taskId)
    .eq("project_id", params.id)
    .eq("tenant_id", ctx.tenantId)

  if (error) return jsonError("Database error", 500, error.message)
  return Response.json({ ok: true })
}
