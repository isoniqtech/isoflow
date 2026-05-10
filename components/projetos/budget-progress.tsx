import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/portugal"

export type BudgetProgressProps = {
  spent: number
  budget: number | null
  threshold?: number
  className?: string
  compact?: boolean
}

export function BudgetProgress({
  spent,
  budget,
  threshold = 80,
  className,
  compact,
}: BudgetProgressProps) {
  if (!budget) {
    return (
      <div className={cn("text-xs text-muted-foreground", className)}>
        Sem orçamento definido
      </div>
    )
  }

  const pct = Math.max(0, Math.min(100, (spent / budget) * 100))
  const overBudget = pct >= 100
  const warning = pct >= threshold && !overBudget

  return (
    <div className={cn("space-y-1", className)}>
      {!compact && (
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium tabular-nums">
            {formatCurrency(spent)}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {formatCurrency(budget)}
          </span>
        </div>
      )}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full transition-all",
            overBudget && "bg-destructive",
            warning && "bg-amber-500",
            !overBudget && !warning && "bg-foreground",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {compact && (
        <div className="text-xs text-muted-foreground tabular-nums">
          {Math.round(pct)}% · {formatCurrency(spent)} / {formatCurrency(budget)}
        </div>
      )}
    </div>
  )
}
