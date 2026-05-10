import Link from "next/link"
import { AlertTriangle, BellRing, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { DashboardAlert } from "@/lib/queries/dashboard"

export function AlertsPanel({ alerts }: { alerts: DashboardAlert[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BellRing className="h-4 w-4" />
          Alertas
        </CardTitle>
        {alerts.length > 0 && (
          <span className="text-xs font-medium text-muted-foreground">
            {alerts.length}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tudo em ordem. Sem alertas no momento.
          </p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <AlertItem key={a.id} alert={a} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function AlertItem({ alert }: { alert: DashboardAlert }) {
  const colors =
    alert.level === "danger"
      ? "border-destructive/40 bg-destructive/5 text-foreground"
      : "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10"

  const iconColor =
    alert.level === "danger"
      ? "text-destructive"
      : "text-amber-600 dark:text-amber-400"

  const inner = (
    <div className={cn("rounded-md border p-3", colors)}>
      <div className="flex items-start gap-2">
        <AlertTriangle className={cn("h-4 w-4 shrink-0 mt-0.5", iconColor)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{alert.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {alert.description}
          </p>
        </div>
        {alert.href && (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        )}
      </div>
    </div>
  )

  if (alert.href) {
    return (
      <li>
        <Link href={alert.href} className="block">
          {inner}
        </Link>
      </li>
    )
  }
  return <li>{inner}</li>
}
