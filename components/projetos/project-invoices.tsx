import Link from "next/link"
import { FileText, Mail, MessageCircle, Upload } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/faturas/status-badge"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import type { ProjectInvoiceRow } from "@/lib/queries/project-detail"
import type { InvoiceSource } from "@/types"

const SOURCE_ICONS: Record<InvoiceSource, typeof FileText> = {
  whatsapp: MessageCircle,
  email: Mail,
  manual: Upload,
  api: FileText,
  erp: FileText,
}

export function ProjectInvoices({
  invoices,
  projectId,
}: {
  invoices: ProjectInvoiceRow[]
  projectId: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">Faturas do projeto</CardTitle>
        <Button size="sm" asChild>
          <Link href={`/faturas/nova?project=${projectId}`}>Adicionar fatura</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <EmptyState projectId={projectId} />
        ) : (
          <ul className="divide-y">
            {invoices.map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function InvoiceRow({ invoice }: { invoice: ProjectInvoiceRow }) {
  const Icon = SOURCE_ICONS[invoice.source] ?? FileText
  return (
    <li>
      <Link
        href={`/faturas/${invoice.id}`}
        className="flex items-center gap-3 py-3 hover:bg-muted/40 -mx-3 px-3 rounded-md transition-colors"
      >
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {invoice.supplier_name ?? "Fornecedor desconhecido"}
          </p>
          <p className="text-xs text-muted-foreground">
            {invoice.invoice_number ?? "Sem número"} ·{" "}
            {invoice.invoice_date ? formatDate(invoice.invoice_date) : "Sem data"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-sm font-semibold tabular-nums">
            {invoice.total !== null ? formatCurrency(invoice.total) : "—"}
          </span>
          <StatusBadge status={invoice.status} />
        </div>
      </Link>
    </li>
  )
}

function EmptyState({ projectId }: { projectId: string }) {
  return (
    <div className="text-center py-6">
      <FileText className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
      <p className="text-sm text-muted-foreground mb-3">
        Sem faturas associadas a este projeto.
      </p>
      <Button size="sm" variant="outline" asChild>
        <Link href={`/faturas/nova?project=${projectId}`}>Adicionar primeira fatura</Link>
      </Button>
    </div>
  )
}
