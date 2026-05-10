import { ArrowDownLeft, ArrowUpRight, Landmark } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import { cn } from "@/lib/utils"

export type BankTxRow = {
  id: string
  date: string
  description: string | null
  account_name: string | null
  iban: string | null
  amount: number
  currency: string
  type: "debit" | "credit" | null
  invoice_id: string | null
}

export function TransactionTable({ rows }: { rows: BankTxRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="border rounded-lg p-12 flex flex-col items-center text-center bg-background">
        <Landmark className="h-10 w-10 text-muted-foreground mb-3" />
        <h2 className="font-semibold mb-1">Sem movimentos para mostrar</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Liga um banco em Configurações &gt; Integrações e sincroniza os
          últimos 90 dias.
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
            <TableHead>Data</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="hidden md:table-cell">Conta</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((tx) => {
            const isDebit = tx.amount < 0 || tx.type === "debit"
            const Icon = isDebit ? ArrowUpRight : ArrowDownLeft
            return (
              <TableRow key={tx.id}>
                <TableCell className="p-2">
                  <div
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center",
                      isDebit
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {formatDate(tx.date)}
                </TableCell>
                <TableCell>
                  <p className="text-sm truncate max-w-md">
                    {tx.description ?? "—"}
                  </p>
                </TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                  <p className="truncate">{tx.account_name ?? "—"}</p>
                  {tx.iban && (
                    <p className="font-mono text-[10px]">{tx.iban}</p>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums font-medium whitespace-nowrap",
                    isDebit
                      ? "text-red-700 dark:text-red-400"
                      : "text-emerald-700 dark:text-emerald-400",
                  )}
                >
                  {isDebit ? "−" : "+"}
                  {formatCurrency(Math.abs(tx.amount))}
                </TableCell>
                <TableCell>
                  {tx.invoice_id ? (
                    <Badge
                      variant="outline"
                      className="bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40"
                    >
                      Conciliado
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Sem match
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
