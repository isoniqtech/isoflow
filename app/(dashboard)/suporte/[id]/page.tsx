import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TicketChat } from "@/components/suporte/ticket-chat"
import { getCurrentSession } from "@/lib/queries/current-session"
import { getTicketWithMessages } from "@/lib/queries/tickets"
import { hasPermission } from "@/lib/utils/permissions"
import { formatDate } from "@/lib/utils/portugal"
import { cn } from "@/lib/utils"
import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/types"

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
    label: "À espera do cliente",
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

const PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
}

const CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  billing: "Faturação",
  technical: "Técnico",
  integration: "Integração",
  invoice: "Fatura",
  banking: "Banco",
  other: "Outro",
}

export default async function TicketDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!hasPermission(session.role, "suporte", "create")) {
    redirect("/")
  }

  const data = await getTicketWithMessages(params.id, session.tenant.id)
  if (!data) notFound()

  const { ticket, messages } = data
  const status = STATUS_STYLES[ticket.status]

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <Link
          href="/suporte"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar a suporte
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                {ticket.title}
              </h1>
              <Badge variant="outline" className={status.className}>
                {status.label}
              </Badge>
              {ticket.priority === "urgent" && (
                <Badge
                  variant="outline"
                  className="bg-red-100 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-900/40"
                >
                  Urgente
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>Por {ticket.creator.name}</span>
              <span>{formatDate(ticket.created_at)}</span>
              {ticket.category && (
                <Badge variant="secondary">{CATEGORY_LABELS[ticket.category]}</Badge>
              )}
              <span>Prioridade: {PRIORITY_LABELS[ticket.priority]}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Pedido inicial</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-line">{ticket.description}</p>
            </CardContent>
          </Card>

          <TicketChat
            ticketId={ticket.id}
            currentUserId={session.user.id}
            initialMessages={messages}
            ticketStatus={ticket.status}
            isSupport={false}
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estado</span>
                <Badge variant="outline" className={cn("text-xs", status.className)}>
                  {status.label}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Prioridade</span>
                <span>{PRIORITY_LABELS[ticket.priority]}</span>
              </div>
              {ticket.category && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Categoria</span>
                  <span>{CATEGORY_LABELS[ticket.category]}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mensagens</span>
                <span>{messages.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aberto</span>
                <span>{formatDate(ticket.created_at)}</span>
              </div>
              {ticket.first_response_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">1ª resposta</span>
                  <span>{formatDate(ticket.first_response_at)}</span>
                </div>
              )}
              {ticket.resolved_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resolvido</span>
                  <span>{formatDate(ticket.resolved_at)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Quem abriu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{ticket.creator.name}</p>
              <p className="text-xs text-muted-foreground break-all">
                {ticket.creator.email}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
