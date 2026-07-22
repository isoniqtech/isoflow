import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { log } from "@/lib/utils/audit"

const projectUpdateSchema = z
  .object({
    name: z.string().min(1).max(100),
    code: z.string().trim().max(50).nullable(),
    description: z.string().max(2000).nullable(),
    type: z.enum(["obra", "projeto", "departamento", "cliente", "outro"]),
    status: z.enum(["active", "completed", "paused", "cancelled"]),
    budget: z.number().positive().max(999_999_999).nullable(),
    budget_alert_threshold: z.number().int().min(0).max(200),
    start_date: z.string().date().nullable(),
    end_date: z.string().date().nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    client_name: z.string().trim().max(200).nullable(),
    location: z.string().trim().max(200).nullable(),
    notes: z.string().max(5000).nullable(),
    name_aliases: z.array(z.string().trim().min(1).max(50)).max(20),
  })
  .partial()

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "projetos", "view_own")) {
    return jsonError("Forbidden", 403)
  }

  // Investidor: so' os projetos a que esta' associado (mesma guarda do detalhe)
  if (ctx.role === "investidor") {
    const { getInvestidorProjectIds } = await import("@/lib/queries/investidores")
    const allowed = await getInvestidorProjectIds(ctx.userId)
    if (!allowed.includes(params.id)) return jsonError("Forbidden", 403)
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle()

  if (error) return jsonError("Database error", 500, error.message)
  if (!data) return jsonError("Not found", 404)
  return Response.json({ data })
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "projetos", "edit")) {
    return jsonError("Forbidden", 403)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError("Invalid JSON", 400)
  }

  const parsed = projectUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError("Validation error", 400, parsed.error.flatten())
  }

  const supabase = createClient()

  // Renomear: o nome tem de continuar unico no tenant (a pasta do Drive e'
  // identificada pelo nome do projeto).
  if (typeof parsed.data.name === "string") {
    const { data: duplicado } = await supabase
      .from("projects")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .eq("name", parsed.data.name)
      .neq("id", params.id)
      .maybeSingle()
    if (duplicado) {
      return jsonError("Já existe um projeto com este nome", 409)
    }
  }

  const { data, error } = await supabase
    .from("projects")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)
    .select("*")
    .maybeSingle()

  if (error) {
    // 23505 = unique_violation do indice (tenant_id, name) numa corrida
    if (error.code === "23505") {
      return jsonError("Já existe um projeto com este nome", 409)
    }
    return jsonError("Could not update project", 500, error.message)
  }
  if (!data) return jsonError("Not found", 404)

  // Refletir o novo nome na pasta do Drive, se existir. Silencioso: uma falha
  // aqui nao deve impedir a renomeacao do projeto.
  if (typeof parsed.data.name === "string" && data.drive_folder_id) {
    try {
      const { getValidDriveToken, DRIVE_API } = await import("@/lib/google/drive")
      const token = await getValidDriveToken(ctx.tenantId)
      await fetch(`${DRIVE_API}/files/${data.drive_folder_id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: parsed.data.name }),
      })
    } catch {
      // ignorar
    }
  }

  await log(supabase, {
    action: "project.updated",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "project",
    resourceId: data.id,
    metadata: { changed_keys: Object.keys(parsed.data) },
  })

  return Response.json({ data })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "projetos", "delete")) {
    return jsonError("Forbidden", 403)
  }

  const supabase = createClient()
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)

  if (error) return jsonError("Could not delete project", 500, error.message)

  await log(supabase, {
    action: "project.deleted",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "project",
    resourceId: params.id,
  })

  return Response.json({ ok: true })
}
