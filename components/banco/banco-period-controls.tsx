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

export type BancoPeriod = "mensal"

const STORAGE_KEY = "banco-period-filters"

type SavedFilters = {
  month: number
  year: number
}

export function BancoPeriodControls({
  month,
  year,
}: {
  month: number
  year: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const restoredRef = useRef(false)

  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true

    if (searchParams.has("month")) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ month, year }))
      } catch { /* ignore */ }
      return
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved: SavedFilters = JSON.parse(raw)
        if (saved.year) {
          const next = new URLSearchParams()
          next.set("month", String(saved.month))
          next.set("year", String(saved.year))
          router.replace(`${pathname}?${next.toString()}`)
        }
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function navigate(updates: Partial<SavedFilters>) {
    const newMonth = updates.month ?? month
    const newYear = updates.year ?? year
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ month: newMonth, year: newYear }))
    } catch { /* ignore */ }
    const next = new URLSearchParams(searchParams.toString())
    next.set("month", String(newMonth))
    next.set("year", String(newYear))
    next.delete("period")
    next.delete("quarter")
    router.push(`${pathname}?${next.toString()}`)
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 4 }, (_, i) => currentYear - i)

  return (
    <div className="flex flex-wrap items-center gap-2">
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
