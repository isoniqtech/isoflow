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

export const runtime = "nodejs"

const CAMPOS =
  "id, title, description, start_date, end_date, status, visibility, sort_order, created_at"

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

  const { data, error } = await admin()
    .from("project_tasks")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
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
