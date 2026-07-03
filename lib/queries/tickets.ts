import { createClient } from "@/lib/supabase/server"
import type {
  SupportTicket,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
  SupportMessage,
} from "@/types"

export type TicketListItem = {
  id: string
  title: string
  status: SupportTicketStatus
  priority: SupportTicketPriority
  category: SupportTicketCategory | null
  credits_charged: number
  message_count: number
  created_at: string
  updated_at: string
  created_by: { id: string; name: string }
}

export type TicketsFilter = {
  status?: SupportTicketStatus | "all"
  priority?: SupportTicketPriority | "all"
  category?: SupportTicketCategory | "all"
}

export async function listTickets(
  tenantId: string,
  filter?: TicketsFilter,
): Promise<TicketListItem[]> {
  const supabase = createClient()
  let query = supabase
    .from("support_tickets")
    .select(
      "id, title, status, priority, category, credits_charged, created_at, updated_at, created_by",
    )
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(100)

  if (filter?.status && filter.status !== "all") {
    query = query.eq("status", filter.status)
  }
  if (filter?.priority && filter.priority !== "all") {
    query = query.eq("priority", filter.priority)
  }
  if (filter?.category && filter.category !== "all") {
    query = query.eq("category", filter.category)
  }

  const { data: tickets } = await query
  const list = tickets ?? []
  if (list.length === 0) return []

  const userIds = Array.from(new Set(list.map((t) => t.created_by)))
  const { data: users } = await supabase
    .from("users")
    .select("id, name")
    .in("id", userIds)
  const userMap = new Map((users ?? []).map((u) => [u.id, u]))

  const ticketIds = list.map((t) => t.id)
  const messageCounts = new Map<string, number>()
  if (ticketIds.length > 0) {
    const { data: countRows } = await supabase
      .from("support_messages")
      .select("ticket_id")
      .in("ticket_id", ticketIds)
    for (const row of countRows ?? []) {
      messageCounts.set(
        row.ticket_id,
        (messageCounts.get(row.ticket_id) ?? 0) + 1,
      )
    }
  }

  return list.map((t) => {
    const user = userMap.get(t.created_by)
    return {
      id: t.id,
      title: t.title,
      status: (t.status ?? "open") as SupportTicketStatus,
      priority: (t.priority ?? "medium") as SupportTicketPriority,
      category: (t.category ?? null) as SupportTicketCategory | null,
      credits_charged: t.credits_charged ?? 0,
      message_count: messageCounts.get(t.id) ?? 0,
      created_at: t.created_at ?? new Date().toISOString(),
      updated_at: t.updated_at ?? new Date().toISOString(),
      created_by: {
        id: t.created_by,
        name: user?.name ?? "Utilizador",
      },
    }
  })
}

export type TicketWithMessages = {
  ticket: SupportTicket & {
    creator: { id: string; name: string; email: string }
  }
  messages: Array<
    SupportMessage & {
      sender: { id: string; name: string }
    }
  >
}

export async function getTicketWithMessages(
  ticketId: string,
  tenantId: string,
): Promise<TicketWithMessages | null> {
  const supabase = createClient()

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .eq("tenant_id", tenantId)
    .maybeSingle()
  if (!ticket) return null

  const { data: creator } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("id", ticket.created_by)
    .maybeSingle()

  const { data: messageRows } = await supabase
    .from("support_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })

  const senderIds = Array.from(
    new Set((messageRows ?? []).map((m) => m.sender_id)),
  )
  const { data: senders } = await supabase
    .from("users")
    .select("id, name")
    .in("id", senderIds)
  const senderMap = new Map((senders ?? []).map((s) => [s.id, s]))

  const messages = (messageRows ?? []).map((m) => ({
    ...(m as SupportMessage),
    sender: {
      id: m.sender_id,
      name: senderMap.get(m.sender_id)?.name ?? "Utilizador",
    },
  }))

  return {
    ticket: {
      ...(ticket as SupportTicket),
      creator: {
        id: creator?.id ?? ticket.created_by,
        name: creator?.name ?? "Utilizador",
        email: creator?.email ?? "",
      },
    },
    messages,
  }
}

export async function getTicketWithMessagesAdmin(
  ticketId: string,
): Promise<TicketWithMessages | null> {
  const { createAdminClient } = await import("@/lib/supabase/admin")
  const supabase = createAdminClient()

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle()
  if (!ticket) return null

  const { data: creator } = await supabase
    .from("users")
    .select("id, name, email")
    .eq("id", ticket.created_by)
    .maybeSingle()

  const { data: messageRows } = await supabase
    .from("support_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })

  const senderIds = Array.from(
    new Set((messageRows ?? []).map((m) => m.sender_id)),
  )
  const { data: senders } = await supabase
    .from("users")
    .select("id, name")
    .in("id", senderIds)
  const senderMap = new Map((senders ?? []).map((s) => [s.id, s]))

  const messages = (messageRows ?? []).map((m) => ({
    ...(m as unknown as SupportMessage),
    sender: {
      id: m.sender_id,
      name: m.sender_type === "support"
        ? "Suporte"
        : (senderMap.get(m.sender_id)?.name ?? "Cliente"),
    },
  }))

  return {
    ticket: {
      ...(ticket as SupportTicket),
      creator: {
        id: creator?.id ?? ticket.created_by,
        name: creator?.name ?? "Utilizador",
        email: creator?.email ?? "",
      },
    },
    messages,
  }
}

export const TICKET_CREDIT_COST = {
  normal: 5,
  urgent: 10,
} as const
