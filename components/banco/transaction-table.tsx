"use client"

import { useMemo, useState } from "react"
import {
  ArrowDownLeft,
  ArrowUpLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Landmark,
  X,
} from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import { cn } from "@/lib/utils"

export type BankTxRow = {
  id: string
  date: string
  description: string | null
  account_name: string | null
  bank_name: string | null
  iban: string | null
  amount: number
  currency: string
  type: "debit" | "credit" | null
  invoice_id: string | null
  counterparty_name: string | null
  counterparty_iban: string | null
  bank_reference: string | null
  external_status: string | null
}

type SortKey = "date" | "amount" | "description"
type SortDir = "asc" | "desc"

const PT_MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="ml-1 h-3 w-3 inline text-muted-foreground" />
  return sortDir === "asc"
    ? <ChevronUp className="ml-1 h-3 w-3 inline" />
    : <ChevronDown className="ml-1 h-3 w-3 inline" />
}

export function TransactionTable({ rows }: { rows: BankTxRow[] }) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // Derive available years from data
  const availableYears = useMemo(() => {
    const years = new Set(rows.map((r) => new Date(r.date).getFullYear()))
    return Array.from(years).sort((a, b) => b - a)
  }, [rows])

  // Filters
  const [filterYear, setFilterYear] = useState<string>(String(currentYear))
  const [filterMonth, setFilterMonth] = useState<string>("all")
  const [filterFrom, setFilterFrom] = useState("")
  const [filterTo, setFilterTo] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "conciliado" | "por_conciliar">("all")

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const hasDateRangeFilter = filterFrom !== "" || filterTo !== ""

  const filtered = useMemo(() => {
    let list = rows

    // Year filter (skip if date range is set)
    if (!hasDateRangeFilter && filterYear !== "all") {
      list = list.filter((r) => r.date.startsWith(filterYear))
    }

    // Month filter (skip if date range is set)
    if (!hasDateRangeFilter && filterMonth !== "all") {
      const m = filterMonth.padStart(2, "0")
      list = list.filter((r) => r.date.slice(5, 7) === m)
    }

    // Date range
    if (filterFrom) list = list.filter((r) => r.date >= filterFrom)
    if (filterTo) list = list.filter((r) => r.date <= filterTo)

    // Status
    if (filterStatus === "conciliado") list = list.filter((r) => r.invoice_id)
    if (filterStatus === "por_conciliar") list = list.filter((r) => !r.invoice_id)

    // Sort
    list = [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === "date") cmp = a.date.localeCompare(b.date)
      else if (sortKey === "amount") cmp = Math.abs(a.amount) - Math.abs(b.amount)
      else if (sortKey === "description") {
        const da = (a.counterparty_name ?? a.description ?? "").toLowerCase()
        const db = (b.counterparty_name ?? b.description ?? "").toLowerCase()
        cmp = da.localeCompare(db)
      }
      return sortDir === "asc" ? cmp : -cmp
    })

    return list
  }, [rows, filterYear, filterMonth, filterFrom, filterTo, filterStatus, sortKey, sortDir, hasDateRangeFilter])

  function resetFilters() {
    setFilterYear(String(currentYear))
    setFilterMonth("all")
    setFilterFrom("")
    setFilterTo("")
    setFilterStatus("all")
  }

  const hasActiveFilters =
    filterYear !== String(currentYear) ||
    filterMonth !== "all" ||
    filterFrom !== "" ||
    filterTo !== "" ||
    filterStatus !== "all"

  if (rows.length === 0) {
    return (
      <div className="border rounded-lg p-12 flex flex-col items-center text-center bg-background">
        <Landmark className="h-10 w-10 text-muted-foreground mb-3" />
        <h2 className="font-semibold mb-1">Sem movimentos para mostrar</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Liga um banco em Configurações › Integrações.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Year */}
        <Select value={filterYear} onValueChange={setFilterYear} disabled={hasDateRangeFilter}>
          <SelectTrigger className="h-8 w-24 text-xs">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Month */}
        <Select value={filterMonth} onValueChange={setFilterMonth} disabled={hasDateRangeFilter}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {PT_MONTHS.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range */}
        <Input
          type="date"
          value={filterFrom}
          onChange={(e) => setFilterFrom(e.target.value)}
          className="h-8 w-36 text-xs"
          aria-label="De"
          placeholder="De"
        />
        <Input
          type="date"
          value={filterTo}
          onChange={(e) => setFilterTo(e.target.value)}
          className="h-8 w-36 text-xs"
          aria-label="Até"
          placeholder="Até"
        />

        {/* Status */}
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="conciliado">Conciliado</SelectItem>
            <SelectItem value="por_conciliar">Por conciliar</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>
            <X className="mr-1 h-3 w-3" />
            Limpar
          </Button>
        )}

        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div className="border rounded-lg p-8 flex flex-col items-center text-center bg-background">
          <p className="text-sm text-muted-foreground">Sem movimentos para os filtros selecionados.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-background overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => toggleSort("date")}
                >
                  Data <SortIcon col="date" sortKey={sortKey} sortDir={sortDir} />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("description")}
                >
                  Descrição <SortIcon col="description" sortKey={sortKey} sortDir={sortDir} />
                </TableHead>
                <TableHead className="hidden md:table-cell">Conta</TableHead>
                <TableHead
                  className="text-right cursor-pointer select-none whitespace-nowrap"
                  onClick={() => toggleSort("amount")}
                >
                  Valor <SortIcon col="amount" sortKey={sortKey} sortDir={sortDir} />
                </TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tx) => {
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
                      <p className="text-sm truncate max-w-md font-medium">
                        {tx.counterparty_name ?? tx.description ?? "—"}
                      </p>
                      {((tx.counterparty_name && tx.description) || tx.bank_reference) ? (
                        <p className="text-xs text-muted-foreground truncate max-w-md">
                          {tx.counterparty_name && tx.description ? tx.description : null}
                          {tx.counterparty_name && tx.description && tx.bank_reference && " · "}
                          {tx.bank_reference && (
                            <span className="font-mono">ref {tx.bank_reference}</span>
                          )}
                        </p>
                      ) : null}
                      {tx.counterparty_iban && (
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {tx.counterparty_iban}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      <p className="truncate">
                        {tx.bank_name && tx.account_name
                          ? `${tx.bank_name} · ${tx.account_name}`
                          : (tx.account_name ?? "—")}
                      </p>
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
                      <div className="flex flex-col gap-1 items-start">
                        {tx.invoice_id ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40"
                          >
                            Conciliado
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Por conciliar
                          </Badge>
                        )}
                        {tx.external_status === "PENDING" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/40"
                          >
                            Pendente
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
