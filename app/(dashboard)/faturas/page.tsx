import Link from "next/link"
import { redirect } from "next/navigation"
import { Download, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InvoiceTable } from "@/components/faturas/invoice-table"
import { InvoiceFilters } from "@/components/faturas/invoice-filters"
import { InvoicesPagination } from "./invoices-pagination"
import { getCurrentSession } from "@/lib/queries/current-session"
import {
  listInvoices,
  listProjectOptions,
  type InvoicesFilter,
} from "@/lib/queries/invoices"
import { hasPermission } from "@/lib/utils/permissions"
import type { InvoiceSource, InvoiceStatus } from "@/types"

const VALID_STATUS: Array<InvoiceStatus | "all"> = [
  "all",
  "pending",
  "processing",
  "matched",
  "paid",
  "rejected",
  "duplicate",
]

const VALID_SOURCE: Array<InvoiceSource | "all"> = [
  "all",
  "manual",
  "whatsapp",
  "email",
  "api",
  "erp",
]

export default async function FaturasPage({
  searchParams,
}: {
  searchParams: {
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
    status,
    source,
    project_id,
    needs_review,
    date_from: date_from || undefined,
    date_to: date_to || undefined,
  }

  const [{ invoices, total, page_size }, projects] = await Promise.all([
    listInvoices(session.tenant.id, {
      role: session.role,
      userId: session.user.id,
      filter,
      page,
    }),
    listProjectOptions(session.tenant.id),
  ])

  const canCreate = hasPermission(session.role, "faturas", "create")
  // Capture variable shadowing — TypeScript precisa que `hasPermission` esteja em scope no JSX.
  // Já está importado em cima.

  const totalPages = Math.max(1, Math.ceil(total / page_size))

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Faturas</h1>
          <p className="text-muted-foreground text-sm">
            {total.toLocaleString("pt-PT")}{" "}
            {total === 1 ? "fatura" : "faturas"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasPermission(session.role, "relatorios", "view_all") && total > 0 && (
            <Button variant="outline" asChild>
              <a
                href={`/api/faturas/export?${new URLSearchParams({
                  ...(status !== "all" ? { status } : {}),
                  ...(source !== "all" ? { source } : {}),
                  ...(project_id !== "all" ? { project: project_id } : {}),
                  ...(needs_review ? { review: "1" } : {}),
                  ...(date_from ? { from: date_from } : {}),
                  ...(date_to ? { to: date_to } : {}),
                }).toString()}`}
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </a>
            </Button>
          )}
          {canCreate && (
            <Button asChild>
              <Link href="/faturas/nova">
                <Plus className="mr-2 h-4 w-4" />
                Nova fatura
              </Link>
            </Button>
          )}
        </div>
      </div>

      <InvoiceFilters
        value={{
          status,
          source,
          project_id,
          needs_review,
          date_from,
          date_to,
        }}
        projects={projects}
      />

      <InvoiceTable invoices={invoices} />

      {totalPages > 1 && (
        <InvoicesPagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={page_size}
        />
      )}
    </div>
  )
}
