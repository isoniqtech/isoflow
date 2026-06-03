"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const PT_MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

export type BancoPeriod = "mensal" | "trimestral"

export function BancoPeriodControls({
  period,
  month,
  quarter,
  year,
}: {
  period: BancoPeriod
  month: number
  quarter: number
  year: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function navigate(updates: Partial<{ period: BancoPeriod; month: number; quarter: number; year: number }>) {
    const next = new URLSearchParams(searchParams.toString())
    const newPeriod = updates.period ?? period
    next.set("period", newPeriod)
    next.set("year", String(updates.year ?? year))
    if (newPeriod === "mensal") {
      next.set("month", String(updates.month ?? month))
      next.delete("quarter")
    } else {
      next.set("quarter", String(updates.quarter ?? quarter))
      next.delete("month")
    }
    router.push(`${pathname}?${next.toString()}`)
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 4 }, (_, i) => currentYear - i)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Toggle mensal / trimestral */}
      <div className="inline-flex rounded-md border bg-background overflow-hidden">
        {(["mensal", "trimestral"] as BancoPeriod[]).map((p) => (
          <button
            key={p}
            onClick={() => navigate({ period: p })}
            className={cn(
              "px-3 py-1.5 text-sm font-medium transition-colors",
              period === p
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            {p === "mensal" ? "Mensal" : "Trimestral"}
          </button>
        ))}
      </div>

      {/* Seletor de mês ou trimestre */}
      {period === "mensal" ? (
        <Select value={String(month)} onValueChange={(v) => navigate({ month: Number(v) })}>
          <SelectTrigger className="h-8 text-sm w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PT_MONTHS.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Select value={String(quarter)} onValueChange={(v) => navigate({ quarter: Number(v) })}>
          <SelectTrigger className="h-8 text-sm w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">T1 — Jan/Mar</SelectItem>
            <SelectItem value="2">T2 — Abr/Jun</SelectItem>
            <SelectItem value="3">T3 — Jul/Set</SelectItem>
            <SelectItem value="4">T4 — Out/Dez</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Seletor de ano */}
      <Select value={String(year)} onValueChange={(v) => navigate({ year: Number(v) })}>
        <SelectTrigger className="h-8 text-sm w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
