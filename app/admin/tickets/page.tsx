import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { listAdminTickets } from "@/lib/queries/admin"
import { formatDate } from "@/lib/utils/portugal"
import { cn } from "@/lib/utils"
import type { SupportTicketPriority, SupportTicketStatus } from "@/types"

const STATUS_STYLES: Record<SupportTicketStatus, { label: string; className: string }> = {
  open: {
    label: "Aberto",
    className:
      "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-900/40",
  },
  in_progress: {
    label: "Em curso",
    className:
      "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/40",
  },
  waiting_client: {
    label: "Espera cliente",
    className:
      "bg-purple-100 text-purple-900 border-purple-200 dark:bg-purple-900/20 dark:text-purple-200 dark:border-purple-900/40",
  },
  resolved: {
    label: "Resolvido",
    className:
      "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40",
  },
  closed: {
    label: "Fechado",
    className:
      "bg-zinc-200 text-zinc-800 border-zinc-300 dark:bg-zinc-800/40 dark:text-zinc-200 dark:border-zinc-700",
  },
}

const PRIORITY_LABELS: Record<SupportTicketPriority, { label: string; className: string }> = {
  low: { label: "Baixa", className: "text-muted-foreground" },
  medium: { label: "Média", className: "" },
  high: { label: "Alta", className: "text-amber-600 dark:text-amber-400" },
  urgent: { label: "Urgente", className: "text-destructive font-semibold" },
}

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

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: { status?: string; priority?: string; tenant_id?: string }
}) {
  const status = (VALID_STATUS as string[]).includes(searchParams.status ?? "")
    ? (searchParams.status as SupportTicketStatus | "all")
    : "all"
  const priority = (VALID_PRIORITY as string[]).includes(
    searchParams.priority ?? "",
  )
    ? (searchParams.priority as SupportTicketPriority | "all")
    : "all"

  const tickets = await listAdminTickets({
    status,
    priority,
    tenant_id: searchParams.tenant_id,
  })

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tickets de todos os clientes</h1>
        <p className="text-muted-foreground text-sm">
          {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"}
        </p>
      </div>

      <div className="rounded-lg border bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden md:table-cell">Criado por</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden lg:table-cell text-right">Mensagens</TableHead>
              <TableHead className="hidden lg:table-cell">Atualizado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-12">
                  Sem tickets para os filtros escolhidos.
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((t) => {
                const s = STATUS_STYLES[t.status]
                const p = PRIORITY_LABELS[t.priority]
                return (
                  <TableRow key={t.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/suporte/${t.id}`} className="block">
                        <p className="font-medium truncate max-w-md">{t.title}</p>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/clientes/${t.tenant.id}`} className="block hover:underline">
                        <p className="text-sm font-medium truncate">{t.tenant.name}</p>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      <Link href={`/suporte/${t.id}`} className="block">
                        <p className="font-medium truncate">{t.creator.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {t.creator.email}
                        </p>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/suporte/${t.id}`} className={cn("block text-sm", p.className)}>
                        {p.label}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/suporte/${t.id}`} className="block">
                        <Badge variant="outline" className={s.className}>
                          {s.label}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right text-sm">
                      <Link href={`/suporte/${t.id}`} className="block">
                        {t.message_count}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      <Link href={`/suporte/${t.id}`} className="block">
                        {formatDate(t.updated_at)}
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
