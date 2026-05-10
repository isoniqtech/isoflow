import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/portugal"

export type IntegrationStatus = "connected" | "disconnected" | "error" | "soon"

export type IntegrationCardProps = {
  icon: LucideIcon
  title: string
  description: string
  status: IntegrationStatus
  provider?: string | null
  lastSyncAt?: string | null
  errorMessage?: string | null
  onConnectLabel?: string
  onConnectDisabled?: boolean
  onConnectTitle?: string
}

const STATUS_STYLES: Record<
  IntegrationStatus,
  { label: string; dot: string; className: string }
> = {
  connected: {
    label: "Ligado",
    dot: "bg-emerald-500",
    className:
      "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40",
  },
  disconnected: {
    label: "Desligado",
    dot: "bg-muted-foreground",
    className: "",
  },
  error: {
    label: "Erro",
    dot: "bg-destructive",
    className:
      "bg-red-100 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-900/40",
  },
  soon: {
    label: "Em breve",
    dot: "bg-amber-500",
    className:
      "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/40",
  },
}

export function IntegrationCard({
  icon: Icon,
  title,
  description,
  status,
  provider,
  lastSyncAt,
  errorMessage,
  onConnectLabel = "Ligar",
  onConnectDisabled,
  onConnectTitle,
}: IntegrationCardProps) {
  const s = STATUS_STYLES[status]
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{title}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          <Badge variant="outline" className={cn("shrink-0", s.className)}>
            <span className={cn("h-1.5 w-1.5 rounded-full mr-1.5", s.dot)} />
            {s.label}
          </Badge>
        </div>

        {provider && status === "connected" && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{provider}</span>
            {lastSyncAt && (
              <>
                {" · "}última sincronização {formatDate(lastSyncAt)}
              </>
            )}
          </p>
        )}

        {errorMessage && status === "error" && (
          <p className="text-xs text-destructive">{errorMessage}</p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {status === "connected" ? (
            <Button variant="outline" size="sm" disabled title="Em breve">
              Desligar
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={onConnectDisabled || status === "soon"}
              title={onConnectTitle ?? (status === "soon" ? "Em breve" : undefined)}
            >
              {onConnectLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
