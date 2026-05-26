import Link from "next/link"
import { GitMerge, FileText, AlertTriangle } from "lucide-react"
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

export function PorConciliarTab({ invoices }: { invoices: InvoiceListItem[] }) {
  if (invoices.length === 0) {
    return (
      <div className="border rounded-lg p-12 flex flex-col items-center text-center bg-background">
        <GitMerge className="h-10 w-10 text-muted-foreground mb-3" />
        <h2 className="font-semibold mb-1">Todas conciliadas</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Não há faturas por conciliar com movimentos bancários. Bom trabalho!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm text-muted-foreground">
          {invoices.length} fatura{invoices.length !== 1 ? "s" : ""} sem correspondência bancária
        </p>
      </div>
      <div className="rounded-lg border bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="hidden md:table-cell">Nº Fatura</TableHead>
              <TableHead className="hidden lg:table-cell">Data</TableHead>
              <TableHead className="hidden md:table-cell">Projeto</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => {
              const overdue =
                inv.due_date &&
                inv.status !== "paid" &&
                inv.status !== "rejected" &&
                new Date(inv.due_date) < new Date()
              return (
                <TableRow key={inv.id} className="cursor-pointer">
                  <TableCell className="p-0">
                    <Link
                      href={`/faturas/${inv.id}`}
                      className="block px-2 py-3 h-full"
                      aria-label="Ver fatura"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/faturas/${inv.id}`} className="block">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {inv.supplier_name ?? "Fornecedor desconhecido"}
                        </span>
                        {inv.needs_review && (
                          <AlertTriangle
                            className="h-3.5 w-3.5 text-amber-600 shrink-0"
                            aria-label="Necessita revisão"
                          />
                        )}
                      </div>
                      {inv.supplier_nif && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {inv.supplier_nif}
                        </p>
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
                      <span className={cn(overdue && "text-destructive font-medium")}>
                        {inv.invoice_date ? formatDate(inv.invoice_date) : "—"}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Link href={`/faturas/${inv.id}`} className="block">
                      {inv.project ? (
                        <Badge
                          variant="outline"
                          className="font-normal"
                          style={{
                            borderColor: inv.project.color,
                            color: inv.project.color,
                          }}
                        >
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
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
