"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useTransition } from "react"
import { SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ProjectStatus, ProjectType } from "@/types"

export function ProjectsFilters({
  status,
  type,
}: {
  status: ProjectStatus | "all"
  type: ProjectType | "all"
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function setParam(key: "status" | "type", value: string) {
    const next = new URLSearchParams(searchParams.toString())
    if (value === "all") next.delete(key)
    else next.set(key, value)
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`)
    })
  }

  function clearInner() {
    const next = new URLSearchParams(searchParams.toString())
    next.delete("status")
    next.delete("type")
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`)
    })
  }

  const activeInner = (status !== "all" ? 1 : 0) + (type !== "all" ? 1 : 0)

  return (
    <div data-pending={isPending || undefined}>
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
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Estado</label>
            <Select value={status} onValueChange={(v) => setParam("status", v)}>
              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="paused">Pausados</SelectItem>
                <SelectItem value="completed">Concluídos</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tipo</label>
            <Select value={type} onValueChange={(v) => setParam("type", v)}>
              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="obra">Obra</SelectItem>
                <SelectItem value="projeto">Projeto</SelectItem>
                <SelectItem value="departamento">Departamento</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
    </div>
  )
}
