"use client"

import { useTransition, useState, useEffect } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TenantPlan, TenantStatus } from "@/types"

export function AdminClientsFilters({
  status,
  plan,
  credits,
  q,
}: {
  status: TenantStatus | "all"
  plan: TenantPlan | "all"
  credits: "zero" | "low" | "all"
  q: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(q)

  useEffect(() => {
    setSearch(q)
  }, [q])

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString())
    if (value === null || value === "" || value === "all") {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`)
    })
  }

  function reset() {
    setSearch("")
    startTransition(() => {
      router.push(pathname)
    })
  }

  const hasActive =
    status !== "all" || plan !== "all" || credits !== "all" || q !== ""

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-pending={isPending || undefined}
    >
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setParam("q", search)
          }}
          onBlur={() => setParam("q", search)}
          placeholder="Pesquisar por nome..."
          className="pl-8 w-[220px]"
        />
      </div>

      <Select value={status} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os estados</SelectItem>
          <SelectItem value="trial">Trial</SelectItem>
          <SelectItem value="active">Ativo</SelectItem>
          <SelectItem value="suspended">Suspenso</SelectItem>
          <SelectItem value="cancelled">Cancelado</SelectItem>
        </SelectContent>
      </Select>

      <Select value={plan} onValueChange={(v) => setParam("plan", v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os planos</SelectItem>
          <SelectItem value="starter">Starter</SelectItem>
          <SelectItem value="business">Business</SelectItem>
          <SelectItem value="pro">Pro</SelectItem>
          <SelectItem value="enterprise">Enterprise</SelectItem>
        </SelectContent>
      </Select>

      <Select value={credits} onValueChange={(v) => setParam("credits", v)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos (créditos)</SelectItem>
          <SelectItem value="zero">Sem créditos</SelectItem>
          <SelectItem value="low">Créditos baixos (&lt;100)</SelectItem>
        </SelectContent>
      </Select>

      {hasActive && (
        <Button variant="ghost" size="sm" onClick={reset}>
          <X className="mr-1 h-3.5 w-3.5" />
          Limpar
        </Button>
      )}
    </div>
  )
}
