import Link from "next/link"
import { redirect } from "next/navigation"
import { AlertTriangle, ChevronRight } from "lucide-react"
import { getCurrentSession } from "@/lib/queries/current-session"
import { getInvoiceDetail } from "@/lib/queries/invoice-detail"
import { hasPermission } from "@/lib/utils/permissions"
import { InvoiceDetail } from "@/components/faturas/invoice-detail"
import { InvoiceActions } from "@/components/faturas/invoice-actions"
import { ExpenseCategorySelect } from "@/components/faturas/expense-category-select"

export default async function FaturaDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!hasPermission(session.role, "faturas", "view_own")) redirect("/projetos")

  const invoice = await getInvoiceDetail(params.id, session.tenant.id, {
    restrictToCreatedBy:
      session.role === "member" ? session.user.id : undefined,
  })
  if (!invoice) redirect("/faturas")

  // Investidor: verificar que a fatura pertence a um dos seus projetos
  if (session.role === "investidor") {
    const { getInvestidorProjectIds } = await import("@/lib/queries/investidores")
    const allowed = await getInvestidorProjectIds(session.user.id)
    if (!invoice.project?.id || !allowed.includes(invoice.project.id)) redirect("/faturas")
  }

  // Categoria de gasto: a IA decide na primeira vez que a fatura e' vista,
  // se ainda nao tiver nenhuma. Silencioso - falhas deixam a escolha ao utilizador.
  let expenseCategoryCode = (invoice as { expense_category_code?: string | null }).expense_category_code ?? null
  const categoriaJaExistia = Boolean(expenseCategoryCode)
  if (!expenseCategoryCode) {
    const { createClient } = await import("@/lib/supabase/server")
    const { ensureInvoiceExpenseCategory } = await import("@/lib/toconline/assign-expense-category")
    expenseCategoryCode = await ensureInvoiceExpenseCategory(invoice.id, session.tenant.id, createClient())
  }

  const canEdit = hasPermission(session.role, "faturas", "edit")
  const canDelete = hasPermission(session.role, "faturas", "delete")

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/faturas" className="hover:text-foreground">
          Faturas
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        <span className="text-foreground font-medium truncate">
          {invoice.invoice_number ?? invoice.supplier_name ?? invoice.id.slice(0, 8)}
        </span>
      </nav>

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">
            {invoice.supplier_name ?? "Fornecedor desconhecido"}
          </h1>
          {invoice.invoice_number && (
            <p className="text-sm text-muted-foreground font-mono mt-0.5">
              {invoice.invoice_number}
            </p>
          )}
        </div>
        <InvoiceActions
          invoiceId={invoice.id}
          status={invoice.status}
          canEdit={canEdit}
          canDelete={canDelete}
          erpSynced={Boolean(invoice.erp_synced)}
          needsReview={invoice.needs_review}
        />
      </div>

      {/* Banner needs_review */}
      {invoice.needs_review && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Esta fatura foi marcada para revisão. Verifique os dados extraídos pela IA antes de confirmar.
        </div>
      )}

      {/* Conteúdo principal */}
      <ExpenseCategorySelect
        invoiceId={invoice.id}
        currentCode={expenseCategoryCode}
        decidedByAi={!categoriaJaExistia}
        canEdit={canEdit}
        alreadySent={
          Boolean(invoice.erp_synced) ||
          Boolean((invoice as { toconline_fc_id?: string | null }).toconline_fc_id)
        }
      />

      <InvoiceDetail invoice={invoice} canEdit={canEdit} />
    </div>
  )
}
