import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { log } from "@/lib/utils/audit"

const ticketUpdateSchema = z
  .object({
    status: z.enum([
      "open",
      "in_progress",
      "waiting_client",
      "resolved",
      "closed",
    ]),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    satisfaction_rating: z.number().int().min(1).max(5).nullable(),
  })
  .partial()

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "suporte", "create")) {
    return jsonError("Forbidden", 403)
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from("support_tickets")
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
  if (!hasPermission(ctx.role, "suporte", "create")) {
    return jsonError("Forbidden", 403)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError("Invalid JSON", 400)
  }

  const parsed = ticketUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError("Validation error", 400, parsed.error.flatten())
  }

  const supabase = createClient()
  const updateData: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  }
  if (parsed.data.status === "resolved") {
    updateData.resolved_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from("support_tickets")
    .update(updateData)
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenantId)
    .select("*")
    .maybeSingle()

  if (error) return jsonError("Could not update ticket", 500, error.message)
  if (!data) return jsonError("Not found", 404)

  await log(supabase, {
    action: "ticket.updated",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "support_ticket",
    resourceId: data.id,
    metadata: { changed_keys: Object.keys(parsed.data) },
  })

  return Response.json({ data })
}
