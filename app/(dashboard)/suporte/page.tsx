import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TicketList } from "@/components/suporte/ticket-list"
import { TicketsFilters } from "./tickets-filters"
import { getCurrentSession } from "@/lib/queries/current-session"
import { listTickets } from "@/lib/queries/tickets"
import { hasPermission } from "@/lib/utils/permissions"
import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/types"

const VALID_STATUS: Array<SupportTicketStatus | "all"> = [
  "all",
  "open",
  "in_progress",
  "waiting_client",
  "resolved",
  "closed",
]
const VALID_PRIORITY: Array<SupportTicketPriority | "all"> = [
  "all",
  "low",
  "medium",
  "high",
  "urgent",
]
const VALID_CATEGORY: Array<SupportTicketCategory | "all"> = [
  "all",
  "billing",
  "technical",
  "integration",
  "invoice",
  "banking",
  "other",
]

export default async function SuportePage({
  searchParams,
}: {
  searchParams: { status?: string; priority?: string; category?: string }
}) {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!hasPermission(session.role, "suporte", "create")) {
    redirect("/")
  }

  const status = (VALID_STATUS as string[]).includes(searchParams.status ?? "")
    ? (searchParams.status as SupportTicketStatus | "all")
    : "all"
  const priority = (VALID_PRIORITY as string[]).includes(
    searchParams.priority ?? "",
  )
    ? (searchParams.priority as SupportTicketPriority | "all")
    : "all"
  const category = (VALID_CATEGORY as string[]).includes(
    searchParams.category ?? "",
  )
    ? (searchParams.category as SupportTicketCategory | "all")
    : "all"

  const tickets = await listTickets(session.tenant.id, {
    status,
    priority,
    category,
  })

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Suporte</h1>
          <p className="text-muted-foreground text-sm">
            {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"}
          </p>
        </div>
        <Button asChild>
          <Link href="/suporte/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo ticket
          </Link>
        </Button>
      </div>

      <TicketsFilters status={status} priority={priority} category={category} />

      <TicketList tickets={tickets} />
    </div>
  )
}
