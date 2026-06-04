import Link from "next/link"
import { redirect } from "next/navigation"
import { Download, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InvoiceTableFC } from "@/components/faturas/invoice-table-fc"
import { InvoiceFilters } from "@/components/faturas/invoice-filters"
import { InvoicesRealtime } from "@/components/faturas/invoices-realtime"
import { InvoicesPagination } from "./invoices-pagination"
import { EFaturaTab } from "@/components/faturas/efatura-tab"
import { getCurrentSession } from "@/lib/queries/current-session"
import { listInvoices, listProjectOptions, type InvoicesFilter } from "@/lib/queries/invoices"
import { listEFaturaPageData } from "@/lib/queries/efatura-documents"
import { hasPermission } from "@/lib/utils/permissions"
import { cn } from "@/lib/utils"
import type { InvoiceSource, InvoiceStatus } from "@/types"

const VALID_STATUS: Array<InvoiceStatus | "all"> = [
  "all", "em_sistema", "necessita_revisao", "enviada_erp", "rejected", "duplicate",
  "pending", "processing", "matched", "paid", "reconciled",
]
const VALID_SOURCE: Array<InvoiceSource | "all"> = [
  "all", "manual", "whatsapp", "email", "api", "erp",
]
const VALID_TABS = ["todas", "efatura"] as const
type Tab = (typeof VALID_TABS)[number]

export default async function FaturasPage({
  searchParams,
}: {
  searchParams: {
    tab?: string
    status?: string
    source?: string
    project?: string
    review?: string
    from?: string
    to?: string
    page?: string
  }
}) {
  const session = await getCurrentSession()
  if (!session) redirect("/login")

  const activeTab: Tab = (VALID_TABS as readonly string[]).includes(searchParams.tab ?? "")
    ? (searchParams.tab as Tab)
    : "todas"

  const status = (VALID_STATUS as string[]).includes(searchParams.status ?? "")
    ? (searchParams.status as InvoiceStatus | "all")
    : "all"
  const source = (VALID_SOURCE as string[]).includes(searchParams.source ?? "")
    ? (searchParams.source as InvoiceSource | "all")
    : "all"
  const project_id = searchParams.project ?? "all"
  const needs_review = searchParams.review === "1"
  const date_from = searchParams.from ?? ""
  const date_to = searchParams.to ?? ""
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1)

  const filter: InvoicesFilter = {
    status, source, project_id, needs_review,
    date_from: date_from || undefined,
    date_to: date_to || undefined,
  }

  const [todasResult, projects, eFaturaPageData] = await Promise.all([
    listInvoices(session.tenant.id, { role: session.role, userId: session.user.id, filter, page }),
    listProjectOptions(session.tenant.id),
    listEFaturaPageData(session.tenant.id, session.role, session.user.id),
  ])

  const { invoices, total, page_size } = todasResult
  const canCreate = hasPermission(session.role, "faturas", "create")
  const totalPages = Math.max(1, Math.ceil(total / page_size))

  const eFaturaPending = eFaturaPageData.invoices.filter(i => !i.efatura_doc_id).length

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "todas", label: "Todas", count: total },
    { id: "efatura", label: "e-Fatura", count: eFaturaPending || undefined },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <InvoicesRealtime tenantId={session.tenant.id} />

      {/* Secção estática — header + tabs + filtros */}
      <div className="flex-shrink-0 px-4 md:px-6 lg:px-8 pt-4 md:pt-6 lg:pt-8 space-y-4 max-w-7xl mx-auto w-full">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Faturas</h1>
            <p className="text-muted-foreground text-sm">
              {total.toLocaleString("pt-PT")} {total === 1 ? "fatura" : "faturas"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasPermission(session.role, "relatorios", "view_all") && total > 0 && (
              <Button variant="outline" asChild>
                <a href={`/api/faturas/export?${new URLSearchParams({
                  ...(status !== "all" ? { status } : {}),
                  ...(source !== "all" ? { source } : {}),
                  ...(project_id !== "all" ? { project: project_id } : {}),
                  ...(needs_review ? { review: "1" } : {}),
                  ...(date_from ? { from: date_from } : {}),
                  ...(date_to ? { to: date_to } : {}),
                }).toString()}`}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar CSV
                </a>
              </Button>
            )}
            {canCreate && activeTab !== "efatura" && (
              <Button asChild>
                <Link href="/faturas/nova">
                  <Plus className="mr-2 h-4 w-4" />
                  Nova fatura
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b flex gap-0">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={`/faturas?tab=${tab.id}`}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5",
                activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground",
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  "text-xs rounded-full px-1.5 py-0.5 font-medium",
                  activeTab === tab.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  tab.id === "efatura" && "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
                )}>
                  {tab.count}
                </span>
              )}
            </Link>
          ))}
        </div>

        {activeTab === "todas" && (
          <InvoiceFilters
            value={{ status, source, project_id, needs_review, date_from, date_to }}
            projects={projects}
          />
        )}
      </div>

      {/* Tabela — flex-1, só as linhas fazem scroll */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col px-4 md:px-6 lg:px-8 py-4">
        <div className="flex-1 min-h-0 flex flex-col max-w-7xl mx-auto w-full">
          {activeTab === "todas" && <InvoiceTableFC invoices={invoices} />}
          {activeTab === "efatura" && <EFaturaTab data={eFaturaPageData} />}
        </div>
      </div>

      {/* Paginação — estática no fundo */}
      {activeTab === "todas" && totalPages > 1 && (
        <div className="flex-shrink-0 px-4 md:px-6 lg:px-8 pb-4 max-w-7xl mx-auto w-full">
          <InvoicesPagination page={page} totalPages={totalPages} total={total} pageSize={page_size} />
        </div>
      )}
    </div>
  )
}
