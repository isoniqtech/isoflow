"use client"

import { useTransition } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { CalendarDays, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { ProjectOption } from "@/lib/queries/invoices"
import type { InvoiceSource, InvoiceStatus } from "@/types"

export type InvoiceFiltersValue = {
  status: InvoiceStatus | "all"
  source: InvoiceSource | "all"
  project_id: string | "all" | "none"
  needs_review: boolean
  date_from: string
  date_to: string
}

const TRIGGER = "h-9 bg-card border-border/60 shadow-sm rounded-md"

export function InvoiceFilters({
  value,
  projects,
}: {
  value: InvoiceFiltersValue
  projects: ProjectOption[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function setParam(key: string, val: string | null) {
    const next = new URLSearchParams(searchParams.toString())
    if (val === null || val === "" || val === "all") {
      next.delete(key)
    } else {
      next.set(key, val)
    }
    next.delete("page")
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`)
    })
  }

  function reset() {
    startTransition(() => {
      router.push(pathname)
    })
  }

  const hasActive =
    value.status !== "all" ||
    value.source !== "all" ||
    value.project_id !== "all" ||
    value.needs_review ||
    searchParams.has("from") ||
    searchParams.has("to")

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-pending={isPending || undefined}
    >
      <Select value={value.status} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger className={cn(TRIGGER, "w-[140px]")}>
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os estados</SelectItem>
          <SelectItem value="em_sistema">Em Sistema</SelectItem>
          <SelectItem value="necessita_revisao">Necessita Revisão</SelectItem>
          <SelectItem value="enviada_erp">Enviada ERP</SelectItem>
          <SelectItem value="rejected">Rejeitada</SelectItem>
          <SelectItem value="duplicate">Duplicada</SelectItem>
        </SelectContent>
      </Select>

      <Select value={value.project_id} onValueChange={(v) => setParam("project", v)}>
        <SelectTrigger className={cn(TRIGGER, "w-[170px]")}>
          <SelectValue placeholder="Projeto" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os projetos</SelectItem>
          <SelectItem value="none">Sem projeto</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={value.source} onValueChange={(v) => setParam("source", v)}>
        <SelectTrigger className={cn(TRIGGER, "w-[140px]")}>
          <SelectValue placeholder="Origem" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as origens</SelectItem>
          <SelectItem value="manual">Manual</SelectItem>
          <SelectItem value="whatsapp">WhatsApp</SelectItem>
          <SelectItem value="email">Email</SelectItem>
          <SelectItem value="api">API</SelectItem>
          <SelectItem value="erp">ERP</SelectItem>
        </SelectContent>
      </Select>

      {/* Periodo — datas agrupadas num so' controlo */}
      <div className="inline-flex items-center gap-1.5 h-9 px-2.5 bg-card border border-border/60 shadow-sm rounded-md">
        <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          type="date"
          value={value.date_from}
          onChange={(e) => setParam("from", e.target.value)}
          className="h-7 w-[120px] border-0 bg-transparent shadow-none px-1 focus-visible:ring-0"
          aria-label="Data início"
        />
        <span className="text-muted-foreground text-sm">–</span>
        <Input
          type="date"
          value={value.date_to}
          onChange={(e) => setParam("to", e.target.value)}
          className="h-7 w-[120px] border-0 bg-transparent shadow-none px-1 focus-visible:ring-0"
          aria-label="Data fim"
        />
      </div>

      <Button
        variant={value.needs_review ? "default" : "outline"}
        size="sm"
        className={cn("h-9", !value.needs_review && "bg-card border-border/60 shadow-sm")}
        onClick={() => setParam("review", value.needs_review ? null : "1")}
      >
        Necessita revisão
      </Button>

      {hasActive && (
        <Button variant="ghost" size="sm" className="h-9" onClick={reset}>
          <X className="mr-1 h-3.5 w-3.5" />
          Limpar
        </Button>
      )}
    </div>
  )
}
