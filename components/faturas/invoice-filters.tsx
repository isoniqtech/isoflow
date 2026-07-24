"use client"

import { useTransition } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DateInput } from "@/components/ui/date-input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
  document_kind: "all" | "invoice" | "credit_note"
  needs_review: boolean
  date_from: string
  date_to: string
}

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

  // Limpa so' os filtros do popover (estado/projeto/origem/tipo).
  function clearInner() {
    const next = new URLSearchParams(searchParams.toString())
    for (const k of ["status", "project", "source", "kind"]) next.delete(k)
    next.delete("page")
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`)
    })
  }

  const activeInner =
    (value.status !== "all" ? 1 : 0) +
    (value.source !== "all" ? 1 : 0) +
    (value.project_id !== "all" ? 1 : 0) +
    (value.document_kind !== "all" ? 1 : 0)

  return (
    <div className="flex flex-wrap items-center gap-2" data-pending={isPending || undefined}>
      {/* Filtrar — consolida estado, projeto, origem e tipo */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 bg-card border-border/60 shadow-sm">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filtrar
            {activeInner > 0 && (
              <span className="ml-2 inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-primary text-primary-foreground text-[10px] px-1">
                {activeInner}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-3 space-y-3">
          <FilterField label="Estado">
            <Select value={value.status} onValueChange={(v) => setParam("status", v)}>
              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                <SelectItem value="em_sistema">Em Sistema</SelectItem>
                <SelectItem value="necessita_revisao">Necessita Revisão</SelectItem>
                <SelectItem value="enviada_erp">Enviada ERP</SelectItem>
                <SelectItem value="rejected">Rejeitada</SelectItem>
                <SelectItem value="duplicate">Duplicada</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Projeto">
            <Select value={value.project_id} onValueChange={(v) => setParam("project", v)}>
              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os projetos</SelectItem>
                <SelectItem value="none">Sem projeto</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Origem">
            <Select value={value.source} onValueChange={(v) => setParam("source", v)}>
              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="erp">ERP</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Tipo de documento">
            <Select value={value.document_kind} onValueChange={(v) => setParam("kind", v)}>
              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Faturas e notas de crédito</SelectItem>
                <SelectItem value="invoice">Só faturas</SelectItem>
                <SelectItem value="credit_note">Só notas de crédito</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>

          {activeInner > 0 && (
            <button
              onClick={clearInner}
              className="w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
            >
              Limpar filtros
            </button>
          )}
        </PopoverContent>
      </Popover>

      {/* Periodo — datas agrupadas, com o icone de calendario em cada input */}
      <div className="inline-flex items-center gap-1.5 h-9 px-2.5 bg-card border border-border/60 shadow-sm rounded-md">
        <DateInput value={value.date_from} onChange={(v) => setParam("from", v)} ariaLabel="Data início" />
        <span className="text-muted-foreground text-sm">–</span>
        <DateInput value={value.date_to} onChange={(v) => setParam("to", v)} ariaLabel="Data fim" />
      </div>

      <Button
        variant={value.needs_review ? "default" : "outline"}
        size="sm"
        className={cn("h-9", !value.needs_review && "bg-card border-border/60 shadow-sm")}
        onClick={() => setParam("review", value.needs_review ? null : "1")}
      >
        Necessita revisão
      </Button>
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
