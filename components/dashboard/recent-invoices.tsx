import Link from "next/link"
import { FileText, Mail, MessageCircle, Upload } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/faturas/status-badge"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import type { InvoiceSource, InvoiceStatus } from "@/types"

type RecentInvoice = {
  id: string
  supplier_name: string | null
  invoice_number: string | null
  total: number | null
  status: InvoiceStatus
  source: InvoiceSource
  invoice_date: string | null
  created_at: string
}

const SOURCE_ICONS: Record<InvoiceSource, typeof FileText> = {
  whatsapp: MessageCircle,
  email: Mail,
  manual: Upload,
  api: FileText,
  erp: FileText,
}

const SOURCE_LABELS: Record<InvoiceSource, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  manual: "Manual",
  api: "API",
  erp: "ERP",
}

export function RecentInvoices({ invoices }: { invoices: RecentInvoice[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Atividade recente</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/faturas">Ver todas</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <EmptyState />
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

function InvoiceRow({ invoice }: { invoice: RecentInvoice }) {
  const SourceIcon = SOURCE_ICONS[invoice.source] ?? FileText
  return (
    <li>
      <Link
        href={`/faturas/${invoice.id}`}
        className="flex items-center gap-3 py-3 hover:bg-muted/40 -mx-3 px-3 rounded-md transition-colors"
      >
        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
          <SourceIcon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {invoice.supplier_name ?? "Fornecedor desconhecido"}
          </p>
          <p className="text-xs text-muted-foreground">
            {invoice.invoice_number ?? "Sem número"} ·{" "}
            {invoice.invoice_date
              ? formatDate(invoice.invoice_date)
              : "Sem data"}{" "}
            · {SOURCE_LABELS[invoice.source]}
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

function EmptyState() {
  return (
    <div className="text-center py-8">
      <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
      <p className="text-sm text-muted-foreground mb-3">
        Ainda não tens faturas. Envia a primeira via WhatsApp, email ou faz
        upload manual.
      </p>
      <Button size="sm" asChild>
        <Link href="/faturas/nova">Fazer upload</Link>
      </Button>
    </div>
  )
}
