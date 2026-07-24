import { redirect } from "next/navigation"
import { InvoiceTableFC } from "@/components/faturas/invoice-table-fc"
import { InvoicesRealtime } from "@/components/faturas/invoices-realtime"
import { InvoicesPagination } from "./invoices-pagination"
import { EFaturaTab } from "@/components/faturas/efatura-tab"
import { SegmentedTabs } from "@/components/ui/segmented-tabs"
import { getCurrentSession } from "@/lib/queries/current-session"
import { listInvoices, listProjectOptions, type InvoicesFilter } from "@/lib/queries/invoices"
import { listEFaturaPageData } from "@/lib/queries/efatura-documents"
import { hasPermission } from "@/lib/utils/permissions"
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
  // Por defeito, o periodo e' o mes atual (1 -> hoje) - MAS so' quando nao ha'
  // outro filtro ativo. Se o utilizador filtra por estado/origem/projeto/revisao,
  // nao limitamos ao mes (senao "Em Sistema" mostrava vazio se estivesse fora do mes).
  const hasOtherFilter =
    status !== "all" || source !== "all" || project_id !== "all" || needs_review
  const now = new Date()
  const monthFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  const monthTo = now.toISOString().slice(0, 10)
  const date_from = searchParams.from ?? (hasOtherFilter ? "" : monthFrom)
  const date_to = searchParams.to ?? (hasOtherFilter ? "" : monthTo)
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

  const showEFaturaTab = session.role !== "investidor"
  const tabs: { id: Tab; label: string }[] = [
    { id: "todas", label: "Todas" },
    ...(showEFaturaTab ? [{ id: "efatura" as Tab, label: "e-Fatura" }] : []),
  ]

  const canExport = hasPermission(session.role, "relatorios", "view_all") && total > 0
  const exportUrl = `/api/faturas/export?${new URLSearchParams({
    ...(status !== "all" ? { status } : {}),
    ...(source !== "all" ? { source } : {}),
    ...(project_id !== "all" ? { project: project_id } : {}),
    ...(needs_review ? { review: "1" } : {}),
    ...(date_from ? { from: date_from } : {}),
    ...(date_to ? { to: date_to } : {}),
  }).toString()}`

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <InvoicesRealtime tenantId={session.tenant.id} />

      {/* Secção estática — header + tabs. Mesma estrutura da tabela (px fora,
          max-w dentro) para as tabs alinharem a' face da tabela. */}
      <div className="flex-shrink-0 px-4 md:px-6 lg:px-8 pt-4 md:pt-6 lg:pt-8">
        <div className="space-y-4 max-w-7xl mx-auto w-full">
          <h1 className="text-2xl font-display font-semibold tracking-tight">Faturas</h1>

          {/* Tabs — controlo segmentado (mesmo padrao dos projetos) */}
          <SegmentedTabs
            tabs={tabs}
            activeId={activeTab}
            hrefFor={(id) => `/faturas?tab=${id}`}
          />
        </div>
      </div>

      {/* Tabela — flex-1, só as linhas fazem scroll */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col px-4 md:px-6 lg:px-8 py-4">
        <div className="flex-1 min-h-0 flex flex-col max-w-7xl mx-auto w-full">
          {activeTab === "todas" && (
            <InvoiceTableFC
              invoices={invoices}
              canEdit={hasPermission(session.role, "faturas", "edit")}
              canCreate={canCreate}
              exportUrl={canExport ? exportUrl : null}
              filterProjects={projects}
              filterValue={{ status, source, project_id, needs_review, date_from, date_to }}
            />
          )}
          {activeTab === "efatura" && <EFaturaTab data={eFaturaPageData} />}
        </div>
      </div>

      {/* Paginação — estática no fundo */}
      {activeTab === "todas" && totalPages > 1 && (
        <div className="flex-shrink-0 px-4 md:px-6 lg:px-8 pb-4">
          <div className="max-w-7xl mx-auto w-full">
            <InvoicesPagination page={page} totalPages={totalPages} total={total} pageSize={page_size} />
          </div>
        </div>
      )}
    </div>
  )
}
