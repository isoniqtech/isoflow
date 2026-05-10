import Link from "next/link"
import { LifeBuoy, MessageCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/utils/portugal"
import { cn } from "@/lib/utils"
import type { TicketListItem } from "@/lib/queries/tickets"
import type { SupportTicketCategory, SupportTicketPriority, SupportTicketStatus } from "@/types"

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

const PRIORITY_STYLES: Record<SupportTicketPriority, { label: string; className: string }> = {
  low: { label: "Baixa", className: "text-muted-foreground" },
  medium: { label: "Média", className: "" },
  high: { label: "Alta", className: "text-amber-600 dark:text-amber-400" },
  urgent: { label: "Urgente", className: "text-destructive font-semibold" },
}

const CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  billing: "Faturação",
  technical: "Técnico",
  integration: "Integração",
  invoice: "Fatura",
  banking: "Banco",
  other: "Outro",
}

export function TicketList({ tickets }: { tickets: TicketListItem[] }) {
  if (tickets.length === 0) {
    return (
      <div className="border rounded-lg p-12 flex flex-col items-center text-center bg-background">
        <LifeBuoy className="h-10 w-10 text-muted-foreground mb-3" />
        <h2 className="font-semibold mb-1">Sem tickets de suporte</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          Quando precisares de ajuda, abre um ticket. A equipa ISONIQ TECH
          responde via chat na própria plataforma.
        </p>
        <Button asChild>
          <Link href="/suporte/novo">Abrir primeiro ticket</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-background overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead className="hidden sm:table-cell">Categoria</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="hidden md:table-cell">Mensagens</TableHead>
            <TableHead className="hidden lg:table-cell">Atualizado</TableHead>
            <TableHead className="text-right">Créditos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((t) => {
            const status = STATUS_STYLES[t.status]
            const priority = PRIORITY_STYLES[t.priority]
            return (
              <TableRow key={t.id} className="cursor-pointer">
                <TableCell>
                  <Link href={`/suporte/${t.id}`} className="block">
                    <p className="font-medium truncate max-w-md">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Por {t.created_by.name}
                    </p>
                  </Link>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Link href={`/suporte/${t.id}`} className="block">
                    {t.category ? (
                      <Badge variant="secondary">{CATEGORY_LABELS[t.category]}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/suporte/${t.id}`} className={cn("block text-sm", priority.className)}>
                    {priority.label}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/suporte/${t.id}`} className="block">
                    <Badge variant="outline" className={status.className}>
                      {status.label}
                    </Badge>
                  </Link>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Link href={`/suporte/${t.id}`} className="block text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {t.message_count}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                  <Link href={`/suporte/${t.id}`} className="block">
                    {formatDate(t.updated_at)}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  <Link href={`/suporte/${t.id}`} className="block">
                    {t.credits_charged}
                  </Link>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
