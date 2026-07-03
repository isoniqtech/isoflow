import Link from "next/link"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { Landmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { TransactionTable } from "@/components/banco/transaction-table"
import { BancoPeriodControls } from "@/components/banco/banco-period-controls"
import { BankCallbackToast } from "@/components/banco/bank-connect"
import { AutoReconcileButton } from "@/components/banco/auto-reconcile-button"
import { ImportStatementModal } from "@/components/banco/import-statement-modal"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"
import type { BankTransaction } from "@/types"
import type { BankAccountConfig } from "@/app/api/integracoes/banco/route"
const PT_MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

function getPeriodRange(month: number, year: number): { start: string; end: string; label: string } {
  const lastDay = new Date(year, month, 0).getDate()
  return {
    start: `${year}-${String(month).padStart(2, "0")}-01`,
    end: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    label: `${PT_MONTHS_SHORT[month - 1]} ${year}`,
  }
}

export default async function BancoPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string }
}) {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!hasPermission(session.role, "banco", "view_all")) {
    redirect("/")
  }

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const year = parseInt(searchParams.year ?? String(currentYear), 10) || currentYear
  const month = Math.min(12, Math.max(1, parseInt(searchParams.month ?? String(currentMonth), 10) || currentMonth))

  const { start, end, label } = getPeriodRange(month, year)

  const supabase = createClient()

  const [{ data: bankingIntegration }, { data: transactions }] = await Promise.all([
    supabase
      .from("tenant_integrations")
      .select("config, is_active")
      .eq("tenant_id", session.tenant.id)
      .eq("type", "banking")
      .eq("provider", "manual")
      .maybeSingle(),
    supabase
      .from("bank_transactions")
      .select("*")
      .eq("tenant_id", session.tenant.id)
      .order("date", { ascending: false })
      .limit(1000),
  ])

  // Contas configuradas em Integrações
  const configuredAccounts: BankAccountConfig[] = Array.isArray(
    (bankingIntegration?.config as Record<string, unknown> | null)?.accounts,
  )
    ? ((bankingIntegration!.config as { accounts: BankAccountConfig[] }).accounts)
    : []

  const hasConfiguredAccounts = configuredAccounts.length > 0

  const txList = (transactions ?? []) as BankTransaction[]

  // KPIs para o período selecionado
  const periodTx = txList.filter((t) => t.date >= start && t.date <= end)
  const periodTotal = periodTx.length
  const periodMatched = periodTx.filter((t) => t.invoice_id).length
  const periodUnmatched = periodTotal - periodMatched
  const matchedPct = periodTotal > 0 ? Math.round((periodMatched / periodTotal) * 100) : 0
  const unmatchedPct = periodTotal > 0 ? Math.round((periodUnmatched / periodTotal) * 100) : 0

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Suspense>
        <BankCallbackToast />
      </Suspense>

      {/* Secção estática — header + KPIs + contas */}
      <div className="flex-shrink-0 px-4 md:px-6 lg:px-8 pt-4 md:pt-6 lg:pt-8 space-y-4 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Banco</h1>
            <p className="text-muted-foreground text-sm">
              {periodTotal.toLocaleString("pt-PT")} movimentos · {periodMatched} conciliados · {label}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ImportStatementModal accounts={configuredAccounts} />
            {hasConfiguredAccounts && <AutoReconcileButton />}
          </div>
        </div>

        {/* Empty state */}
        {!hasConfiguredAccounts && (
          <Card>
            <CardContent className="p-6 flex flex-col items-center text-center">
              <Landmark className="h-10 w-10 text-muted-foreground mb-3" />
              <h2 className="font-semibold mb-1">Nenhum banco configurado</h2>
              <p className="text-sm text-muted-foreground max-w-md mb-4">
                Configura os teus bancos e contas em Integrações para começares
                a importar extratos e conciliar movimentos.
              </p>
              <Button asChild size="sm">
                <Link href="/configuracoes/integracoes">Ir para Integrações</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* KPIs com selector de período */}
        {hasConfiguredAccounts && (
          <div className="space-y-3">
            <Suspense>
              <BancoPeriodControls month={month} year={year} />
            </Suspense>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Movimentos</p>
                  <p className="text-2xl font-semibold tabular-nums">{periodTotal}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Conciliados</p>
                  <p className="text-2xl font-semibold tabular-nums">{periodMatched}</p>
                  <p className="text-xs text-muted-foreground">
                    {periodTotal > 0 ? `${matchedPct}% do total` : "—"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Por conciliar</p>
                  <p className="text-2xl font-semibold tabular-nums">{periodUnmatched}</p>
                  <p className="text-xs text-muted-foreground">
                    {periodTotal > 0 ? `${unmatchedPct}% do total` : "—"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Contas configuradas */}
        {hasConfiguredAccounts && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Contas configuradas:</span>
            {configuredAccounts.map((a) => (
              <Badge key={a.id} variant="secondary" className="font-normal">
                {a.label}
                {a.iban && (
                  <span className="ml-2 font-mono text-muted-foreground text-[10px]">
                    {a.iban.slice(-8)}
                  </span>
                )}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Tabela de transações — flex-1 passa a altura ao componente */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col px-4 md:px-6 lg:px-8 py-4">
        <div className="flex-1 min-h-0 flex flex-col max-w-7xl mx-auto w-full">
          <TransactionTable
            rows={txList.map((t) => ({
              id: t.id,
              date: t.date,
              description: t.description,
              account_name: t.account_name,
              bank_name: t.bank_name,
              iban: t.iban,
              amount: Number(t.amount ?? 0),
              currency: t.currency ?? "EUR",
              type: t.type as "debit" | "credit" | null,
              invoice_id: t.invoice_id,
              counterparty_name: t.counterparty_name,
              counterparty_iban: t.counterparty_iban,
              bank_reference: t.bank_reference,
            }))}
          />

          <p className="flex-shrink-0 pt-2 text-xs text-muted-foreground">
            <Link href="/conciliacao" className="hover:underline">
              Ir para a página de conciliação →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
