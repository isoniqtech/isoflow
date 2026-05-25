import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { InvoiceStatus } from "@/types"

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  pending: "Pendente",
  processing: "A processar",
  matched: "Conciliada",
  paid: "Paga",
  rejected: "Rejeitada",
  duplicate: "Duplicada",
  reconciled: "Conciliada AT",
}

const STATUS_CLASSES: Record<InvoiceStatus, string> = {
  pending:
    "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/40",
  processing:
    "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-900/40",
  matched:
    "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40",
  paid: "bg-emerald-200 text-emerald-900 border-emerald-300 dark:bg-emerald-800/30 dark:text-emerald-100 dark:border-emerald-800/60",
  rejected:
    "bg-red-100 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-900/40",
  duplicate:
    "bg-zinc-200 text-zinc-800 border-zinc-300 dark:bg-zinc-800/40 dark:text-zinc-200 dark:border-zinc-700",
  reconciled:
    "bg-violet-100 text-violet-900 border-violet-200 dark:bg-violet-900/20 dark:text-violet-200 dark:border-violet-900/40",
}

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_CLASSES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
