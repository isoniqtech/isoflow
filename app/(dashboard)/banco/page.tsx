import Link from "next/link"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { Landmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { TransactionTable } from "@/components/banco/transaction-table"
import {
  BankConnectButton,
  BankSyncButton,
  BankCallbackToast,
} from "@/components/banco/bank-connect"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import type { BankTransaction } from "@/types"

export default async function BancoPage() {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!hasPermission(session.role, "banco", "view_all")) {
    redirect("/")
  }

  const supabase = createClient()

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
      .limit(200),
  ])

  const txList = (transactions ?? []) as BankTransaction[]
  const totalCount = txList.length
  const matchedCount = txList.filter((t) => t.invoice_id).length
  const unmatchedCount = totalCount - matchedCount
  const unmatchedSum = txList
    .filter((t) => !t.invoice_id)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount ?? 0)), 0)

  const config = (integrationRow?.config ?? {}) as
    | { accounts?: Array<{ id: string; name: string; iban?: string | null }> }
    | null

  const accounts = config?.accounts ?? []
  const isConnected = Boolean(
    integrationRow?.is_active && !integrationRow?.sync_error,
  )

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <Suspense>
        <BankCallbackToast />
      </Suspense>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Banco</h1>
          <p className="text-muted-foreground text-sm">
            {totalCount.toLocaleString("pt-PT")} movimentos · {matchedCount}{" "}
            conciliados
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isConnected ? (
            <>
              <BankSyncButton />
              <BankConnectButton variant="outline" label="Religar" />
            </>
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
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Movimentos
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {totalCount}
              </p>
              <p className="text-xs text-muted-foreground">Últimos 90 dias</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Conciliados
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {matchedCount}
              </p>
              <p className="text-xs text-muted-foreground">
                {totalCount > 0
                  ? `${Math.round((matchedCount / totalCount) * 100)}% do total`
                  : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Sem match
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {unmatchedCount}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(unmatchedSum)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {accounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Contas ligadas:
          </span>
          {accounts.map((a) => (
            <Badge key={a.id} variant="secondary" className="font-normal">
              {a.name}
              {a.iban && (
                <span className="ml-2 font-mono text-muted-foreground">
                  {a.iban}
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
          iban: t.iban,
          amount: Number(t.amount ?? 0),
          currency: t.currency ?? "EUR",
          type: t.type as "debit" | "credit" | null,
          invoice_id: t.invoice_id,
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
