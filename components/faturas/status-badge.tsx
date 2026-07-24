import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { InvoiceStatus } from "@/types"

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  em_sistema:       "Em Sistema",
  necessita_revisao: "Necessita Revisão",
  enviada_erp:      "Enviada ERP",
  rejected:         "Rejeitada",
  duplicate:        "Duplicada",
  // legacy
  pending:          "Em Sistema",
  processing:       "Em Sistema",
  matched:          "Em Sistema",
  paid:             "Em Sistema",
  reconciled:       "Em Sistema",
}

const STATUS_CLASSES: Record<InvoiceStatus, string> = {
  em_sistema:
    "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-900/40",
  necessita_revisao:
    "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/40",
  enviada_erp:
    "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40",
  rejected:
    "bg-red-100 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-900/40",
  duplicate:
    "bg-zinc-200 text-zinc-800 border-zinc-300 dark:bg-zinc-800/40 dark:text-zinc-200 dark:border-zinc-700",
  // legacy — mapeados para em_sistema
  pending:    "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-900/40",
  processing: "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-900/40",
  matched:    "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-900/40",
  paid:       "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-900/40",
  reconciled: "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-900/40",
}

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium whitespace-nowrap", STATUS_CLASSES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
