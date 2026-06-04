import Link from "next/link"
import { AlertTriangle, FileText, Mail, MessageCircle, Upload } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/faturas/status-badge"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import { cn } from "@/lib/utils"
import type { InvoiceListItem } from "@/lib/queries/invoices"
import type { InvoiceSource } from "@/types"

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

function BankBadge({ inv }: { inv: InvoiceListItem }) {
  if (inv.bank_transaction_id) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
        Conciliada
      </span>
    )
  }
  return (
    <span className="text-xs text-muted-foreground">Por conciliar</span>
  )
}

function ATBadge({ inv }: { inv: InvoiceListItem }) {
  if (inv.at_communicated) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
        Compra Registada
      </span>
    )
  }
  if (inv.efatura_at_status) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
        Pendente AT
      </span>
    )
  }
  return (
    <span className="text-xs text-muted-foreground">Sem FC</span>
  )
}

export function InvoiceTable({ invoices }: { invoices: InvoiceListItem[] }) {
  if (invoices.length === 0) {
    return (
      <div className="border rounded-lg p-12 flex flex-col items-center text-center bg-background">
        <FileText className="h-10 w-10 text-muted-foreground mb-3" />
        <h2 className="font-semibold mb-1">Sem faturas para mostrar</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Quando enviares faturas via WhatsApp, email ou upload manual, vão
          aparecer aqui. Tenta também ajustar os filtros.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-background overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead className="hidden md:table-cell">Nº Fatura</TableHead>
            <TableHead className="hidden lg:table-cell">Data</TableHead>
            <TableHead className="hidden lg:table-cell">FC ERP</TableHead>
            <TableHead className="hidden md:table-cell">Projeto</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="hidden xl:table-cell">Bancário</TableHead>
            <TableHead className="hidden xl:table-cell">AT</TableHead>
            <TableHead className="hidden sm:table-cell">Origem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => {
            const SourceIcon = SOURCE_ICONS[inv.source] ?? FileText
            return (
              <TableRow key={inv.id} className="cursor-pointer">
                <TableCell className="p-0">
                  <Link href={`/faturas/${inv.id}`} className="block px-2 py-3 h-full" aria-label="Ver fatura">
                    <SourceIcon className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/faturas/${inv.id}`} className="block">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {inv.supplier_name ?? "Fornecedor desconhecido"}
                      </span>
                      {inv.needs_review && (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-label="Necessita revisão" />
                      )}
                    </div>
                    {inv.supplier_nif && (
                      <p className="text-xs text-muted-foreground font-mono">{inv.supplier_nif}</p>
                    )}
                  </Link>
                </TableCell>
                <TableCell className="hidden md:table-cell font-mono text-sm">
                  <Link href={`/faturas/${inv.id}`} className="block">
                    {inv.invoice_number ?? "—"}
                  </Link>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm">
                  <Link href={`/faturas/${inv.id}`} className="block">
                    {inv.invoice_date ? formatDate(inv.invoice_date) : "—"}
                  </Link>
                </TableCell>
                <TableCell className="hidden lg:table-cell font-mono text-sm">
                  <Link href={`/faturas/${inv.id}`} className="block">
                    {inv.toconline_fc_id ? (
                      <span className="text-foreground">{inv.toconline_fc_id}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Link>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Link href={`/faturas/${inv.id}`} className="block">
                    {inv.project ? (
                      <Badge variant="outline" className="font-normal" style={{ borderColor: inv.project.color, color: inv.project.color }}>
                        {inv.project.name}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  <Link href={`/faturas/${inv.id}`} className="block">
                    {inv.total !== null ? formatCurrency(inv.total) : "—"}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/faturas/${inv.id}`} className="block">
                    <StatusBadge status={inv.status} />
                  </Link>
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <Link href={`/faturas/${inv.id}`} className="block">
                    <BankBadge inv={inv} />
                  </Link>
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <Link href={`/faturas/${inv.id}`} className="block">
                    <ATBadge inv={inv} />
                  </Link>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Link href={`/faturas/${inv.id}`} className="block text-xs text-muted-foreground">
                    {SOURCE_LABELS[inv.source]}
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
