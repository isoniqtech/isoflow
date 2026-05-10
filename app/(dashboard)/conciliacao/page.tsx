import { redirect } from "next/navigation"
import { Sparkles } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { AutoReconcileButton } from "@/components/banco/auto-reconcile-button"
import { MatchCard, type SuggestionRow } from "@/components/conciliacao/match-card"
import { SplitView } from "@/components/conciliacao/split-view"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"
import { formatCurrency } from "@/lib/utils/portugal"

export default async function ConciliacaoPage() {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!hasPermission(session.role, "conciliacao", "view_all")) {
    redirect("/")
  }

  const supabase = createClient()

  const [
    { data: pendingRecRows },
    { data: invoiceRows },
    { data: txRows },
  ] = await Promise.all([
    supabase
      .from("reconciliations")
      .select("id, invoice_id, bank_transaction_id, match_score, created_at")
      .eq("tenant_id", session.tenant.id)
      .eq("status", "pending")
      .order("match_score", { ascending: false })
      .limit(50),
    supabase
      .from("invoices")
      .select("id, supplier_name, invoice_number, invoice_date, total, status")
      .eq("tenant_id", session.tenant.id)
      .in("status", ["pending", "processing"])
      .eq("type", "incoming")
      .not("total", "is", null)
      .order("invoice_date", { ascending: false })
      .limit(100),
    supabase
      .from("bank_transactions")
      .select(
        "id, date, description, counterparty_name, bank_reference, amount, external_status",
      )
      .eq("tenant_id", session.tenant.id)
      .is("invoice_id", null)
      .order("date", { ascending: false })
      .limit(200),
  ])

  // Hidrata sugestões pending com dados das invoices/bank tx
  const invoiceIdsInSuggestions = (pendingRecRows ?? []).map((r) => r.invoice_id)
  const txIdsInSuggestions = (pendingRecRows ?? []).map(
    (r) => r.bank_transaction_id,
  )

  const [{ data: suggInvoices }, { data: suggTxs }] = await Promise.all([
    invoiceIdsInSuggestions.length
      ? supabase
          .from("invoices")
          .select("id, supplier_name, invoice_number, invoice_date, total")
          .in("id", invoiceIdsInSuggestions)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    txIdsInSuggestions.length
      ? supabase
          .from("bank_transactions")
          .select("id, date, description, counterparty_name, bank_reference, amount")
          .in("id", txIdsInSuggestions)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ])

  const invMap = new Map(
    (suggInvoices ?? []).map((i) => [(i as { id: string }).id, i]),
  )
  const txMap = new Map(
    (suggTxs ?? []).map((t) => [(t as { id: string }).id, t]),
  )

  const suggestions: SuggestionRow[] = (pendingRecRows ?? [])
    .map((r) => {
      const inv = invMap.get(r.invoice_id) as
        | {
            id: string
            supplier_name: string | null
            invoice_number: string | null
            invoice_date: string | null
            total: number
          }
        | undefined
      const tx = txMap.get(r.bank_transaction_id) as
        | {
            id: string
            date: string
            description: string | null
            counterparty_name: string | null
            bank_reference: string | null
            amount: number
          }
        | undefined
      if (!inv || !tx) return null
      return {
        reconciliation_id: r.id,
        score: Number(r.match_score ?? 0),
        invoice: { ...inv, total: Number(inv.total) },
        bank_tx: { ...tx, amount: Number(tx.amount) },
      } satisfies SuggestionRow
    })
    .filter((s): s is SuggestionRow => s !== null)

  const invoices = (invoiceRows ?? []).map((i) => ({
    id: i.id,
    supplier_name: i.supplier_name,
    invoice_number: i.invoice_number,
    invoice_date: i.invoice_date,
    total: Number(i.total),
  }))

  const totalUnmatchedInvoiceValue = invoices.reduce((s, i) => s + i.total, 0)
  const txs = (txRows ?? [])
    .filter((t) => t.external_status !== "PENDING")
    .map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      counterparty_name: t.counterparty_name,
      bank_reference: t.bank_reference,
      amount: Number(t.amount),
    }))

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conciliação</h1>
          <p className="text-muted-foreground text-sm">
            {invoices.length} faturas sem match · {txs.length} movimentos sem match
            {invoices.length > 0 && (
              <>
                {" · "}
                {formatCurrency(totalUnmatchedInvoiceValue)} em faturas
              </>
            )}
          </p>
        </div>
        <AutoReconcileButton />
      </div>

      {suggestions.length > 0 && (
        <section className="space-y-3">
          <header className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Sugestões automáticas ({suggestions.length})
            </h2>
          </header>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <MatchCard key={s.reconciliation_id} suggestion={s} />
            ))}
          </div>
        </section>
      )}

      {invoices.length === 0 && txs.length === 0 ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center text-center">
            <Sparkles className="h-10 w-10 text-emerald-500 mb-3" />
            <h2 className="font-semibold mb-1">Tudo conciliado</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Não há faturas ou movimentos por conciliar. Quando chegarem novos,
              corre &quot;Auto-conciliar&quot; para o sistema sugerir matches.
            </p>
          </CardContent>
        </Card>
      ) : (
        <SplitView invoices={invoices} bankTxs={txs} />
      )}
    </div>
  )
}
