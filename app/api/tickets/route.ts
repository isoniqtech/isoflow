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

const TICKET_COSTS = {
  normal: 5,
  urgent: 10,
} as const

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

  const cost = input.priority === "urgent" ? TICKET_COSTS.urgent : TICKET_COSTS.normal

  const { data: tenant } = await supabase
    .from("tenants")
    .select("credits_balance")
    .eq("id", ctx.tenantId)
    .maybeSingle()

  if (!tenant) return jsonError("Tenant not found", 404)
  const balance = tenant.credits_balance ?? 0
  if (balance < cost) {
    return jsonError(
      `Sem créditos suficientes (necessário: ${cost}, saldo: ${balance})`,
      402,
    )
  }

  const { data: ticket, error: insertError } = await supabase
    .from("support_tickets")
    .insert({
      tenant_id: ctx.tenantId,
      created_by: ctx.userId,
      title: input.title,
      description: input.description,
      category: input.category ?? null,
      priority: input.priority,
      credits_charged: cost,
      status: "open",
    })
    .select("*")
    .single()

  if (insertError) {
    console.error("POST /api/tickets insert failed:", insertError)
    return jsonError("Could not create ticket", 500, insertError.message)
  }

  const newBalance = balance - cost
  await supabase
    .from("tenants")
    .update({
      credits_balance: newBalance,
      credits_used_this_month: undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.tenantId)

  await supabase.from("credit_transactions").insert({
    tenant_id: ctx.tenantId,
    amount: -cost,
    type: "usage",
    description: `Ticket de suporte: ${input.title}`,
    reference_id: ticket.id,
    reference_type: "support_ticket",
    balance_after: newBalance,
  })

  await log(supabase, {
    action: "ticket.opened",
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    resourceType: "support_ticket",
    resourceId: ticket.id,
    metadata: { priority: input.priority, credits: cost },
  })

  return Response.json({ data: ticket }, { status: 201 })
}
