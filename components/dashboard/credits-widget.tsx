"use client"

import { Coins } from "lucide-react"
import Link from "next/link"
import { useTenant } from "@/hooks/use-tenant"
import { usePermissions } from "@/hooks/use-permissions"
import { cn } from "@/lib/utils"

const PLAN_QUOTA: Record<string, number> = {
  starter: 500,
  business: 1500,
  pro: 5000,
  enterprise: 10000,
}

export function CreditsWidget() {
  const { tenant } = useTenant()
  const { hasPermission } = usePermissions()
  const quota = PLAN_QUOTA[tenant.plan] ?? 0
  const balance = tenant.credits_balance
  const pct =
    quota > 0 ? Math.max(0, Math.min(100, (balance / quota) * 100)) : 0
  const low = pct < 30

  const content = (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <Coins className="h-3.5 w-3.5" />
          Créditos
        </span>
        <span className="text-xs text-muted-foreground capitalize">
          {tenant.plan}
        </span>
      </div>
      <div className="text-2xl font-semibold tabular-nums">
        {balance.toLocaleString("pt-PT")}
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full transition-all",
            low ? "bg-destructive" : "bg-foreground",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {quota > 0 && (
        <div className="mt-1.5 text-xs text-muted-foreground">
          {balance.toLocaleString("pt-PT")} / {quota.toLocaleString("pt-PT")}
        </div>
      )}
    </>
  )

  const className =
    "block rounded-md border p-3 hover:bg-muted/50 transition-colors"

  if (hasPermission("billing", "view_all")) {
    return (
      <Link href="/configuracoes/plano" className={className}>
        {content}
      </Link>
    )
  }

  return <div className={className}>{content}</div>
}
