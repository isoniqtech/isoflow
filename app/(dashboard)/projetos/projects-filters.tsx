"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useTransition } from "react"
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

  return (
    <div className="flex flex-wrap items-center gap-2" data-pending={isPending || undefined}>
      <Select value={status} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os estados</SelectItem>
          <SelectItem value="active">Ativos</SelectItem>
          <SelectItem value="paused">Pausados</SelectItem>
          <SelectItem value="completed">Concluídos</SelectItem>
          <SelectItem value="cancelled">Cancelados</SelectItem>
        </SelectContent>
      </Select>

      <Select value={type} onValueChange={(v) => setParam("type", v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
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
  )
}
