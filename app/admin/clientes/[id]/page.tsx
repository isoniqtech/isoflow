import Link from "next/link"
import { notFound } from "next/navigation"
import {
  Activity,
  ChevronLeft,
  Coins,
  FileText,
  FolderKanban,
  LifeBuoy,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { AdminClientActions } from "./admin-actions"
import {
  adminActionLabel,
  getAdminClientDetail,
  listAdminAudit,
  PLAN_PRICES,
} from "@/lib/queries/admin"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import { cn } from "@/lib/utils"
import type {
  SupportTicketPriority,
  SupportTicketStatus,
  TenantStatus,
} from "@/types"

const STATUS_STYLES: Record<TenantStatus, { label: string; className: string }> = {
  trial: {
    label: "Trial",
    className:
      "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-900/40",
  },
  active: {
    label: "Ativo",
    className:
      "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40",
  },
  suspended: {
    label: "Suspenso",
    className:
      "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/40",
  },
  cancelled: {
    label: "Cancelado",
    className:
      "bg-red-100 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-900/40",
  },
}

const TICKET_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: "Aberto",
  in_progress: "Em curso",
  waiting_client: "Espera cliente",
  resolved: "Resolvido",
  closed: "Fechado",
}

const PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
}

export default async function AdminClienteDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const data = await getAdminClientDetail(params.id)
  if (!data) notFound()

  const { tenant, owner, user_count, invoice_count, project_count, open_tickets, recent_tickets } = data
  const status = STATUS_STYLES[tenant.status]
  const mrr = tenant.status === "active" ? PLAN_PRICES[tenant.plan] : 0
  const audit = await listAdminAudit(tenant.id, { limit: 20 })

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div>
        <Link
          href="/admin/clientes"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar a clientes
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                {tenant.name}
              </h1>
              <Badge variant="outline" className={status.className}>
                {status.label}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {tenant.plan}
              </Badge>
              {!tenant.onboarding_completed && (
                <Badge
                  variant="outline"
                  className="bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/40"
                >
                  Onboarding por terminar
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {tenant.nif && <span className="font-mono">NIF {tenant.nif}</span>}
              {tenant.email && <span>{tenant.email}</span>}
              <span>Criado em {formatDate(tenant.created_at)}</span>
              {tenant.trial_ends_at && tenant.status === "trial" && (
                <span>Trial até {formatDate(tenant.trial_ends_at)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="MRR" value={formatCurrency(mrr)} icon={Coins} />
        <KpiCard
          label="Créditos"
          value={tenant.credits_balance.toLocaleString("pt-PT")}
          icon={Coins}
          hint={`${tenant.credits_used_this_month.toLocaleString("pt-PT")} usados`}
          className={cn(tenant.credits_balance === 0 && "border-destructive")}
        />
        <KpiCard label="Utilizadores" value={user_count.toString()} icon={Users} />
        <KpiCard label="Projetos" value={project_count.toString()} icon={FolderKanban} />
        <KpiCard label="Faturas" value={invoice_count.toString()} icon={FileText} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Contacto e dono
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {owner ? (
                <div>
                  <p className="font-medium">{owner.name}</p>
                  <p className="text-muted-foreground text-xs">{owner.email}</p>
                </div>
              ) : (
                <p className="text-muted-foreground">Sem owner registado.</p>
              )}
              {tenant.phone && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Telefone: </span>
                  {tenant.phone}
                </p>
              )}
              {tenant.address && (
                <p className="text-sm whitespace-pre-line">
                  <span className="text-muted-foreground">Morada: </span>
                  {tenant.address}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">
                Tickets recentes
              </CardTitle>
              <Badge variant="outline">{open_tickets} abertos</Badge>
            </CardHeader>
            <CardContent>
              {recent_tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem tickets.</p>
              ) : (
                <ul className="divide-y">
                  {recent_tickets.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/admin/tickets/${t.id}`}
                        className="flex items-center justify-between py-2.5 hover:bg-muted/40 -mx-3 px-3 rounded-md gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{t.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(t.created_at)} ·{" "}
                            {PRIORITY_LABELS[t.priority]}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          <LifeBuoy className="h-3 w-3 mr-1" />
                          {TICKET_STATUS_LABELS[t.status]}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Atividade recente
              </CardTitle>
              <Badge variant="outline">{audit.length}</Badge>
            </CardHeader>
            <CardContent>
              {audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sem registos de atividade ainda.
                </p>
              ) : (
                <ul className="divide-y">
                  {audit.map((entry) => (
                    <li key={entry.id} className="py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {adminActionLabel(entry.action)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {entry.user
                              ? `${entry.user.name} (${entry.user.email})`
                              : "Sistema"}
                            {entry.resource_type ? ` · ${entry.resource_type}` : ""}
                          </p>
                          {Object.keys(entry.metadata).length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                              {Object.entries(entry.metadata)
                                .map(([k, v]) => `${k}: ${formatMetaValue(v)}`)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDate(entry.created_at)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <AdminClientActions
          tenantId={tenant.id}
          plan={tenant.plan}
          status={tenant.status}
        />
      </div>
    </div>
  )
}

function formatMetaValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (Array.isArray(value)) return value.map(String).join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}
