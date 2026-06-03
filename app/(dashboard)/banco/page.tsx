import Link from "next/link"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { Landmark, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { TransactionTable } from "@/components/banco/transaction-table"
import { BankCallbackToast } from "@/components/banco/bank-connect"
import { AutoReconcileButton } from "@/components/banco/auto-reconcile-button"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"
import type { BankTransaction } from "@/types"
import type { BankAccountConfig } from "@/app/api/integracoes/banco/route"

export default async function BancoPage() {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!hasPermission(session.role, "banco", "view_all")) {
    redirect("/")
  }

  const supabase = createClient()

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const monthStart = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`
  const lastDay = new Date(currentYear, currentMonth, 0).getDate()
  const monthEnd = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

  const [{ data: bankingIntegration }, { data: transactions }] = await Promise.all([
    // Ler contas manuais configuradas em Integrações
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

  // Contas configuradas manualmente em Configurações → Integrações
  const configuredAccounts: BankAccountConfig[] = Array.isArray(
    (bankingIntegration?.config as Record<string, unknown> | null)?.accounts,
  )
    ? ((bankingIntegration!.config as { accounts: BankAccountConfig[] }).accounts)
    : []

  const hasConfiguredAccounts = configuredAccounts.length > 0

  const txList = (transactions ?? []) as BankTransaction[]

  // KPIs: mês atual
  const monthTx = txList.filter((t) => t.date >= monthStart && t.date <= monthEnd)
  const monthTotal = monthTx.length
  const monthMatched = monthTx.filter((t) => t.invoice_id).length
  const monthUnmatched = monthTotal - monthMatched
  const matchedPct = monthTotal > 0 ? Math.round((monthMatched / monthTotal) * 100) : 0
  const unmatchedPct = monthTotal > 0 ? Math.round((monthUnmatched / monthTotal) * 100) : 0

  const PT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <Suspense>
        <BankCallbackToast />
      </Suspense>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Banco</h1>
          <p className="text-muted-foreground text-sm">
            {monthTotal.toLocaleString("pt-PT")} movimentos em {PT_MONTHS[currentMonth - 1]} · {monthMatched} conciliados
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" disabled title="Em breve">
            <Upload className="mr-2 h-4 w-4" />
            Importar Extrato
          </Button>
          {hasConfiguredAccounts && <AutoReconcileButton />}
        </div>
      </div>

      {/* Empty state — sem bancos configurados */}
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
              <Link href="/configuracoes/integracoes">
                Ir para Integrações
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPI cards — só quando há contas configuradas */}
      {hasConfiguredAccounts && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Movimentos</p>
              <p className="text-2xl font-semibold tabular-nums">{monthTotal}</p>
              <p className="text-xs text-muted-foreground">
                {PT_MONTHS[currentMonth - 1]} {currentYear}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Conciliados</p>
              <p className="text-2xl font-semibold tabular-nums">{monthMatched}</p>
              <p className="text-xs text-muted-foreground">
                {monthTotal > 0 ? `${matchedPct}% do total` : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Por conciliar</p>
              <p className="text-2xl font-semibold tabular-nums">{monthUnmatched}</p>
              <p className="text-xs text-muted-foreground">
                {monthTotal > 0 ? `${unmatchedPct}% do total` : "—"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Contas ligadas — vindas das Integrações */}
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

      {/* Tabela de transações */}
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
          external_status: t.external_status,
        }))}
      />

      <p className="text-xs text-muted-foreground">
        <Link href="/conciliacao" className="hover:underline">
          Ir para a página de conciliação →
        </Link>
      </p>
    </div>
  )
}
