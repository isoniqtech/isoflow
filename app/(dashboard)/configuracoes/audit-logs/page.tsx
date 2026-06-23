import { redirect } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Clock, Mail, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"

const PAGE_SIZE = 50

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!hasPermission(session.role, "integracoes", "view_all")) {
    redirect("/configuracoes")
  }

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = createClient()
  const { data: logs, count } = await supabase
    .from("audit_logs")
    .select("id, action, created_at, user_id, metadata", { count: "exact" })
    .eq("tenant_id", session.tenant.id)
    .eq("action", "email.synced")
    .order("created_at", { ascending: false })
    .range(from, to)

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/configuracoes" className="hover:text-foreground transition-colors">
          Configurações
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Audit Logs</span>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground text-sm">
          Histórico de sincronizações de faturas por email.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Sincronizações de email
            {count !== null && (
              <Badge variant="secondary" className="ml-auto font-normal">
                {count} entradas
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!logs?.length ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              Ainda não há registos de sincronização.
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((entry) => {
                const meta = (entry.metadata ?? {}) as Record<string, unknown>
                const manual = meta.manual === true
                const emailsFetched = Number(meta.emails_fetched ?? 0)
                const invoicesCreated = Number(meta.invoices_created ?? 0)
                const invoiceNumbers = Array.isArray(meta.invoice_numbers)
                  ? (meta.invoice_numbers as string[])
                  : []
                const errorsCount = Number(meta.errors_count ?? 0)
                const since = meta.since ? new Date(meta.since as string) : null
                const until = meta.until ? new Date(meta.until as string) : null

                const createdAt = entry.created_at
                  ? new Date(entry.created_at).toLocaleString("pt-PT", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "-"

                const formatTime = (d: Date) =>
                  d.toLocaleTimeString("pt-PT", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })

                return (
                  <div key={entry.id} className="px-6 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={manual ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {manual ? "Manual" : "Automático"}
                        </Badge>
                        <span className="text-sm font-medium">
                          {invoicesCreated === 0
                            ? "Sem faturas novas"
                            : `${invoicesCreated} fatura${invoicesCreated !== 1 ? "s" : ""} criada${invoicesCreated !== 1 ? "s" : ""}`}
                        </span>
                        {errorsCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {errorsCount} erro{errorsCount !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {createdAt}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        <RefreshCw className="inline h-3 w-3 mr-1" />
                        {emailsFetched} email{emailsFetched !== 1 ? "s" : ""} processado{emailsFetched !== 1 ? "s" : ""}
                      </span>
                      {since && until && (
                        <span>
                          Janela: {formatTime(since)} - {formatTime(until)}
                        </span>
                      )}
                    </div>

                    {invoiceNumbers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {invoiceNumbers.map((num) => (
                          <span
                            key={num}
                            className="inline-flex items-center rounded border bg-muted px-2 py-0.5 text-xs font-mono"
                          >
                            {num}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/configuracoes/audit-logs?page=${page - 1}`}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/configuracoes/audit-logs?page=${page + 1}`}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                Seguinte
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
