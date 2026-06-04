"use client"

import { useEffect } from "react"
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

const QUARTERS = ["T1 (Jan–Mar)", "T2 (Abr–Jun)", "T3 (Jul–Set)", "T4 (Out–Dez)"]

const LS_KEY = "dashboard_filters"

function saveToStorage(params: { mode: DashboardMode; month: number; quarter: number; year: number }) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(params)) } catch {}
}

function loadFromStorage(): { mode: DashboardMode; month: number; quarter: number; year: number } | null {
  try {
    const v = localStorage.getItem(LS_KEY)
    return v ? JSON.parse(v) : null
  } catch { return null }
}

export function DashboardControls({
  mode,
  month,
  quarter,
  year,
  hasParams,
}: {
  mode: DashboardMode
  month: number
  quarter: number
  year: number
  hasParams: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()

  // Restaurar última selecção se não há params na URL
  useEffect(() => {
    if (hasParams) return
    const stored = loadFromStorage()
    if (!stored) return
    const params = new URLSearchParams({
      mode: stored.mode,
      month: String(stored.month),
      quarter: String(stored.quarter),
      year: String(stored.year),
    })
    router.replace(`${pathname}?${params.toString()}`)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function navigate(updates: Partial<{ mode: DashboardMode; month: number; quarter: number; year: number }>) {
    const next = {
      mode: updates.mode ?? mode,
      month: updates.month ?? month,
      quarter: updates.quarter ?? quarter,
      year: updates.year ?? year,
    }
    saveToStorage(next)
    const params = new URLSearchParams({
      mode: next.mode,
      month: String(next.month),
      quarter: String(next.quarter),
      year: String(next.year),
    })
    router.push(`${pathname}?${params.toString()}`)
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">Os filtros definem o que vês</p>
      <div className="flex flex-wrap items-center gap-2">

        {/* 1. Ano */}
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

        {/* 2. Modo */}
        <div className="inline-flex rounded-md border bg-background overflow-hidden">
          {(["mensal", "trimestral", "acumulado"] as DashboardMode[]).map((m) => (
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
              {m === "mensal" ? "Mensal" : m === "trimestral" ? "Trimestral" : "Acumulado"}
            </button>
          ))}
        </div>

        {/* 3. Período (só quando mensal ou trimestral) */}
        {mode === "mensal" && (
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
        )}

        {mode === "trimestral" && (
          <Select value={String(quarter)} onValueChange={(v) => navigate({ quarter: Number(v) })}>
            <SelectTrigger className="h-8 text-sm w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUARTERS.map((q, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{q}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}
