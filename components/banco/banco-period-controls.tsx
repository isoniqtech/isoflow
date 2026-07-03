"use client"

import { useEffect, useRef } from "react"
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

const STORAGE_KEY = "banco-period-filters"

type SavedFilters = {
  period: BancoPeriod
  month: number
  quarter: number
  year: number
}

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
  const restoredRef = useRef(false)

  // On mount: if URL has no period param, try to restore from localStorage
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true

    if (searchParams.has("period")) {
      // URL already has explicit params — save them
      saveToStorage({ period, month, quarter, year })
      return
    }

    // No URL params — try to restore saved preference
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved: SavedFilters = JSON.parse(raw)
        if (saved.period && saved.year) {
          const next = new URLSearchParams()
          next.set("period", saved.period)
          next.set("year", String(saved.year))
          if (saved.period === "mensal") {
            next.set("month", String(saved.month))
          } else {
            next.set("quarter", String(saved.quarter))
          }
          router.replace(`${pathname}?${next.toString()}`)
        }
      }
    } catch {
      // localStorage not available (SSR guard, private mode, etc.)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function saveToStorage(filters: SavedFilters) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
    } catch {
      // ignore
    }
  }

  function navigate(updates: Partial<SavedFilters>) {
    const newPeriod = updates.period ?? period
    const newYear = updates.year ?? year
    const newMonth = updates.month ?? month
    const newQuarter = updates.quarter ?? quarter

    const filters: SavedFilters = {
      period: newPeriod,
      year: newYear,
      month: newMonth,
      quarter: newQuarter,
    }
    saveToStorage(filters)

    const next = new URLSearchParams(searchParams.toString())
    next.set("period", newPeriod)
    next.set("year", String(newYear))
    if (newPeriod === "mensal") {
      next.set("month", String(newMonth))
      next.delete("quarter")
    } else {
      next.set("quarter", String(newQuarter))
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
          <SelectTrigger className="h-8 text-sm w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1.º trimestre (Jan-Mar)</SelectItem>
            <SelectItem value="2">2.º trimestre (Abr-Jun)</SelectItem>
            <SelectItem value="3">3.º trimestre (Jul-Set)</SelectItem>
            <SelectItem value="4">4.º trimestre (Out-Dez)</SelectItem>
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
