import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type KpiVariant = "revenue" | "expense" | "ebitda-pos" | "ebitda-neg" | "neutral"

export type KpiCardProps = {
  label: string
  value: string
  icon: LucideIcon
  hint?: string
  variant?: KpiVariant
  trend?: "up" | "down" | "neutral"
  className?: string
}

const CARD_GRADIENT: Record<KpiVariant, string> = {
  "revenue":    "linear-gradient(135deg, hsl(var(--card)) 30%, rgba(61,174,175,0.09) 100%)",
  "expense":    "linear-gradient(135deg, hsl(var(--card)) 30%, rgba(245,158,11,0.08) 100%)",
  "ebitda-pos": "linear-gradient(135deg, hsl(var(--card)) 30%, rgba(144,199,101,0.10) 100%)",
  "ebitda-neg": "linear-gradient(135deg, hsl(var(--card)) 30%, rgba(239,68,68,0.08) 100%)",
  "neutral":    "linear-gradient(135deg, hsl(var(--card)) 40%, rgba(52,78,13,0.05) 100%)",
}

const ICON_GRADIENT: Record<KpiVariant, string> = {
  "revenue":    "linear-gradient(135deg, #3DAEAF, #1D8192)",
  "expense":    "linear-gradient(135deg, #FBBF24, #F59E0B)",
  "ebitda-pos": "linear-gradient(135deg, #90C765, #62C099)",
  "ebitda-neg": "linear-gradient(135deg, #F87171, #EF4444)",
  "neutral":    "linear-gradient(135deg, #4E7217, #3DAEAF)",
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  variant = "neutral",
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-border/60 p-5 shadow-[var(--shadow-card,0_1px_3px_rgba(0,0,0,0.08))]",
        className,
      )}
      style={{ background: CARD_GRADIENT[variant] }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground tracking-wide">{label}</span>
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: ICON_GRADIENT[variant] }}
        >
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
      </div>
      <div className="font-display text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </div>
      {hint && (
        <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>
      )}
    </div>
  )
}
