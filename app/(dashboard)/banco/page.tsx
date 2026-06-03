import Link from "next/link"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { Landmark, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { TransactionTable } from "@/components/banco/transaction-table"
import {
  BankConnectButton,
  BankCallbackToast,
} from "@/components/banco/bank-connect"
import { AutoReconcileButton } from "@/components/banco/auto-reconcile-button"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"
import { formatDate } from "@/lib/utils/portugal"
import type { BankTransaction } from "@/types"

const ACCOUNT_NAME_PT: Record<string, string> = {
  "current account": "Ordem",
  "checking account": "Ordem",
  "checking": "Ordem",
  "savings account": "Poupança",
  "savings": "Poupança",
  "credit card": "Cartão",
  "business current account": "Empresarial",
  "business account": "Empresarial",
}

function formatAccountLabel(
  bankName: string | null,
  accountName: string | null,
  existingLabels: string[],
): string {
  const bank = bankName?.trim() || "Banco"
  const normalized = (accountName ?? "").trim().toLowerCase()
  const translated = ACCOUNT_NAME_PT[normalized] ?? accountName?.trim() ?? "Conta"
  const label = `${bank} ${translated}`
  // If this exact label already exists, append a counter
  const count = existingLabels.filter((l) => l === label || l.startsWith(label + " ")).length
  return count > 0 ? `${label} ${count + 1}` : label
}

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

  const [{ data: integrationRow }, { data: transactions }] = await Promise.all([
    supabase
      .from("tenant_integrations")
      .select("provider, is_active, last_sync_at, sync_error, config")
      .eq("type", "banking")
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("bank_transactions")
      .select("*")
      .eq("tenant_id", session.tenant.id)
      .order("date", { ascending: false })
      .limit(1000),
  ])

  const txList = (transactions ?? []) as BankTransaction[]

  // KPIs: current month only
  const monthTx = txList.filter((t) => t.date >= monthStart && t.date <= monthEnd)
  const monthTotal = monthTx.length
  const monthMatched = monthTx.filter((t) => t.invoice_id).length
  const monthUnmatched = monthTotal - monthMatched
  const matchedPct = monthTotal > 0 ? Math.round((monthMatched / monthTotal) * 100) : 0
  const unmatchedPct = monthTotal > 0 ? Math.round((monthUnmatched / monthTotal) * 100) : 0

  // Derive unique connected accounts from transactions
  const seenAccounts = new Map<string, { bank_name: string | null; account_name: string | null; iban: string | null }>()
  for (const t of txList) {
    const key = `${t.account_id ?? t.iban ?? t.account_name}`
    if (!seenAccounts.has(key)) {
      seenAccounts.set(key, {
        bank_name: t.bank_name,
        account_name: t.account_name,
        iban: t.iban,
      })
    }
  }

  const accountLabels: string[] = []
  const accountsDisplay = Array.from(seenAccounts.values()).map((a) => {
    const label = formatAccountLabel(a.bank_name, a.account_name, accountLabels)
    accountLabels.push(label)
    return { label, iban: a.iban }
  })

  const isConnected = Boolean(
    integrationRow?.is_active && !integrationRow?.sync_error,
  )

  const PT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <Suspense>
        <BankCallbackToast />
      </Suspense>

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
          {isConnected ? (
            <AutoReconcileButton />
          ) : (
            <>
              <BankConnectButton label="Ligar banco PT" market="PT" />
              <BankConnectButton
                variant="outline"
                label="Testar com Demobank (SE)"
                market="SE"
              />
            </>
          )}
        </div>
      </div>

      {!isConnected && (
        <Card>
          <CardContent className="p-6 flex flex-col items-center text-center">
            <Landmark className="h-10 w-10 text-muted-foreground mb-3" />
            <h2 className="font-semibold mb-1">Liga uma conta bancária</h2>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              O ISOFlow usa Tink (Open Banking europeu) para sincronizar
              movimentos bancários e conciliar com as faturas
              automaticamente. A autenticação acontece no portal do teu banco
              — não armazenamos credenciais.
            </p>
            <p className="text-xs text-muted-foreground max-w-md mb-4">
              Em ambiente sandbox, &quot;Testar com Demobank (SE)&quot; abre o
              banco simulado da Tink (sueco). Para bancos portugueses reais,
              usa &quot;Ligar banco PT&quot;.
            </p>
            {integrationRow?.sync_error && (
              <p className="mt-3 text-xs text-destructive">
                {integrationRow.sync_error}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {isConnected && (
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

      {accountsDisplay.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Contas ligadas:</span>
          {accountsDisplay.map((a, i) => (
            <Badge key={i} variant="secondary" className="font-normal">
              {a.label}
              {a.iban && (
                <span className="ml-2 font-mono text-muted-foreground text-[10px]">
                  {a.iban.slice(-8)}
                </span>
              )}
            </Badge>
          ))}
          {integrationRow?.last_sync_at && (
            <span className="text-xs text-muted-foreground">
              · última sync {formatDate(integrationRow.last_sync_at)}
            </span>
          )}
        </div>
      )}

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
