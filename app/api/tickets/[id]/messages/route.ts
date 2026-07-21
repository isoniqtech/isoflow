import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getApiContext, jsonError } from "@/lib/api/auth"
import type { Database } from "@/types/supabase"

type TicketUpdate = Database["public"]["Tables"]["support_tickets"]["Update"]

const messageSchema = z.object({
  message: z.string().trim().min(1).max(5000),
})

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)

  const isSupport = process.env.SUPER_ADMIN_USER_ID === ctx.userId
  // Super-admin (suporte) atua cross-tenant -> service role; cliente fica com RLS.
  const supabase = isSupport ? createAdminClient() : createClient()

  let ticketQuery = supabase
    .from("support_tickets")
    .select("id")
    .eq("id", params.id)
  if (!isSupport) ticketQuery = ticketQuery.eq("tenant_id", ctx.tenantId)

  const { data: ticket } = await ticketQuery.maybeSingle()
  if (!ticket) return jsonError("Not found", 404)

  const { data, error } = await supabase
    .from("support_messages")
    .select("*")
    .eq("ticket_id", params.id)
    .order("created_at", { ascending: true })

  if (error) return jsonError("Database error", 500, error.message)
  return Response.json({ data })
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError("Invalid JSON", 400)
  }

  const parsed = messageSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError("Validation error", 400, parsed.error.flatten())
  }

  const isSupport = process.env.SUPER_ADMIN_USER_ID === ctx.userId
  // Super-admin (suporte) atua cross-tenant -> service role; cliente fica com RLS.
  const supabase = isSupport ? createAdminClient() : createClient()

  let ticketQuery = supabase
    .from("support_tickets")
    .select("id, status")
    .eq("id", params.id)
  if (!isSupport) ticketQuery = ticketQuery.eq("tenant_id", ctx.tenantId)

  const { data: ticket } = await ticketQuery.maybeSingle()
  if (!ticket) return jsonError("Not found", 404)

  // Clientes nao podem enviar mensagens consecutivas - devem aguardar resposta do suporte
  if (!isSupport) {
    const { data: lastMsg } = await supabase
      .from("support_messages")
      .select("sender_type")
      .eq("ticket_id", params.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastMsg && lastMsg.sender_type === "client") {
      return jsonError("Aguarda a resposta do suporte antes de enviar outra mensagem.", 403)
    }
  }

  const { data, error } = await supabase
    .from("support_messages")
    .insert({
      ticket_id: params.id,
      sender_id: ctx.userId,
      sender_type: isSupport ? "support" : "client",
      message: parsed.data.message,
      attachments: [],
    })
    .select("*")
    .single()

  if (error) {
    console.error("POST messages insert failed:", error)
    return jsonError("Could not send message", 500, error.message)
  }

  const updates: TicketUpdate = {
    updated_at: new Date().toISOString(),
  }
  if (isSupport && ticket.status === "open") {
    updates.status = "in_progress"
    updates.first_response_at = new Date().toISOString()
  }
  await supabase.from("support_tickets").update(updates).eq("id", params.id)

  return Response.json({ data }, { status: 201 })
}
