"use client"

import { useRouter, usePathname } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { DashboardMode } from "@/lib/queries/dashboard"

const PT_MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

export function DashboardControls({
  mode,
  month,
  year,
}: {
  mode: DashboardMode
  month: number
  year: number
}) {
  const router = useRouter()
  const pathname = usePathname()

  function navigate(updates: Partial<{ mode: DashboardMode; month: number; year: number }>) {
    const params = new URLSearchParams({
      mode: updates.mode ?? mode,
      month: String(updates.month ?? month),
      year: String(updates.year ?? year),
    })
    router.push(`${pathname}?${params.toString()}`)
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 4 }, (_, i) => currentYear - i)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Mode toggle */}
      <div className="inline-flex rounded-md border bg-background overflow-hidden">
        {(["mensal", "acumulado"] as DashboardMode[]).map((m) => (
          <button
            key={m}
            onClick={() => navigate({ mode: m })}
            className={cn(
              "px-3 py-1.5 text-sm font-medium transition-colors",
              mode === m
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            {m === "mensal" ? "Mensal" : "Acumulado"}
          </button>
        ))}
      </div>

      {/* Month selector (only in mensal mode) */}
      {mode === "mensal" && (
        <Select value={String(month)} onValueChange={(v) => navigate({ month: Number(v) })}>
          <SelectTrigger className="h-8 text-sm w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PT_MONTHS.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Year selector */}
      <Select value={String(year)} onValueChange={(v) => navigate({ year: Number(v) })}>
        <SelectTrigger className="h-8 text-sm w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
