import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { log } from "@/lib/utils/audit"

const ticketInputSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
  category: z
    .enum(["billing", "technical", "integration", "invoice", "banking", "other"])
    .optional()
    .nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
})


export async function GET() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "suporte", "create")) {
    return jsonError("Forbidden", 403)
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("updated_at", { ascending: false })
    .limit(100)

  if (error) return jsonError("Database error", 500, error.message)
  return Response.json({ data })
}

export async function POST(req: Request) {
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

  const parsed = ticketInputSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError("Validation error", 400, parsed.error.flatten())
  }

  const supabase = createClient()
  const input = parsed.data

  const { data: ticket, error: insertError } = await supabase
    .from("support_tickets")
    .insert({
      tenant_id: ctx.tenantId,
      created_by: ctx.userId,
      title: input.title,
      description: input.description,
      category: input.category ?? null,
      priority: input.priority,
      credits_charged: 0,
      status: "open",
    })
    .select("*")
    .single()

  if (insertError) {
    console.error("POST /api/tickets insert failed:", insertError)
    return jsonError("Could not create ticket", 500, insertError.message)
  }

  await log(supabase, {
    action: "ticket.opened",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "support_ticket",
    resourceId: ticket.id,
    metadata: { priority: input.priority },
  })

  return Response.json({ data: ticket }, { status: 201 })
}
