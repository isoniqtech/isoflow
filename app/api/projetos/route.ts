import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { log } from "@/lib/utils/audit"
import { generateProjectCode } from "@/lib/utils/projects"

const projectInputSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().trim().max(50).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  type: z
    .enum(["obra", "projeto", "departamento", "cliente", "outro"])
    .default("obra"),
  status: z
    .enum(["active", "completed", "paused", "cancelled"])
    .default("active"),
  budget: z.number().positive().max(999_999_999).optional().nullable(),
  budget_alert_threshold: z.number().int().min(0).max(200).default(80),
  start_date: z.string().date().optional().nullable(),
  end_date: z.string().date().optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve ser hex (#RRGGBB)")
    .default("#2563EB"),
  client_name: z.string().trim().max(200).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  name_aliases: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
})

export async function GET() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "projetos", "view_own")) {
    return jsonError("Forbidden", 403)
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })

  if (error) return jsonError("Database error", 500, error.message)
  return Response.json({ data })
}

export async function POST(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "projetos", "create")) {
    return jsonError("Forbidden", 403)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError("Invalid JSON", 400)
  }

  const parsed = projectInputSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError("Validation error", 400, parsed.error.flatten())
  }

  const supabase = createClient()
  const input = parsed.data

  let code = input.code?.trim() || null
  if (!code) {
    const { count } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("type", input.type)
    code = generateProjectCode(input.type, count ?? 0)
  }

  const { data: project, error: insertError } = await supabase
    .from("projects")
    .insert({
      tenant_id: ctx.tenantId,
      name: input.name,
      code,
      description: input.description ?? null,
      type: input.type,
      status: input.status,
      budget: input.budget ?? null,
      budget_alert_threshold: input.budget_alert_threshold,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      color: input.color,
      client_name: input.client_name ?? null,
      location: input.location ?? null,
      notes: input.notes ?? null,
      name_aliases: input.name_aliases,
      created_by: ctx.userId,
    })
    .select("*")
    .single()

  if (insertError) {
    console.error("POST /api/projetos insert failed:", insertError)
    return jsonError("Could not create project", 500, insertError.message)
  }

  await log(supabase, {
    action: "project.created",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "project",
    resourceId: project.id,
    metadata: { name: project.name, type: project.type },
  })

  return Response.json({ data: project }, { status: 201 })
}
