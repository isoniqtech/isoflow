"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronsUpDown, Check } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { TenantSummary } from "@/lib/queries/current-session"

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  accountant: "Contabilista",
  member: "Membro",
  investidor: "Investidor",
}

export function TenantSwitcher({
  current,
  available,
}: {
  current: TenantSummary
  available: TenantSummary[]
}) {
  const [switching, setSwitching] = useState(false)
  const router = useRouter()

  if (available.length <= 1) return null

  async function switchTenant(tenantId: string) {
    if (tenantId === current.id || switching) return
    setSwitching(true)
    try {
      const res = await fetch("/api/auth/switch-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId }),
      })
      if (!res.ok) throw new Error("Falhou")

      const supabase = createClient()
      await supabase.auth.refreshSession()
      router.refresh()
    } catch {
      toast.error("Erro ao mudar de empresa")
    } finally {
      setSwitching(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded px-1 -mx-1",
            switching && "opacity-50 pointer-events-none",
          )}
        >
          <span className="truncate max-w-[120px]">{current.name}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">Empresas</p>
        <DropdownMenuSeparator />
        {available.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => switchTenant(t.id)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div
              className="h-5 w-5 rounded text-white text-[10px] font-bold flex items-center justify-center shrink-0"
              style={{ backgroundColor: t.primary_color }}
            >
              {t.app_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm">{t.name}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABELS[t.role] ?? t.role}</p>
            </div>
            {t.id === current.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
