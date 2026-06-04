"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, FileText, Landmark, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"

export type SplitInvoice = {
  id: string
  supplier_name: string | null
  invoice_number: string | null
  invoice_date: string | null
  total: number
}

export type SplitBankTx = {
  id: string
  date: string
  description: string | null
  counterparty_name: string | null
  bank_reference: string | null
  amount: number
}

export function SplitView({
  invoices,
  bankTxs,
}: {
  invoices: SplitInvoice[]
  bankTxs: SplitBankTx[]
}) {
  const router = useRouter()
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null)
  const [selectedTx, setSelectedTx] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function confirmMatch() {
    if (!selectedInvoice || !selectedTx) return
    setBusy(true)
    const res = await fetch("/api/conciliacao/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        invoice_id: selectedInvoice,
        bank_transaction_id: selectedTx,
      }),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      toast.error("Falha ao conciliar", {
        description: errBody.error ?? `HTTP ${res.status}`,
      })
      setBusy(false)
      return
    }
    toast.success("Conciliação criada")
    setSelectedInvoice(null)
    setSelectedTx(null)
    setBusy(false)
    router.refresh()
  }

  const canConfirm = Boolean(selectedInvoice && selectedTx)

  return (
    <div className="space-y-3">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 sticky top-0 z-10">
        <p className="text-sm text-muted-foreground">
          {selectedInvoice && selectedTx
            ? "Confirma para conciliar"
            : selectedInvoice
              ? "Escolhe um movimento"
              : selectedTx
                ? "Escolhe uma fatura"
                : "Clica numa fatura e num movimento para conciliar manualmente"}
        </p>
        <Button onClick={confirmMatch} disabled={!canConfirm || busy}>
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          Conciliar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-3 items-start">
        {/* Invoices */}
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Faturas por conciliar
              </h3>
              <span className="text-xs text-muted-foreground">
                {invoices.length}
              </span>
            </div>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma fatura por conciliar.
              </p>
            ) : (
              <ul className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                {invoices.map((inv) => {
                  const sel = selectedInvoice === inv.id
                  return (
                    <li key={inv.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedInvoice(sel ? null : inv.id)
                        }
                        className={cn(
                          "w-full text-left rounded-md border p-2.5 transition-colors",
                          sel
                            ? "bg-foreground text-background border-foreground"
                            : "bg-background hover:bg-muted/50",
                        )}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="font-medium truncate text-sm">
                            {inv.supplier_name ?? "Fornecedor"}
                          </p>
                          <p className="font-semibold tabular-nums text-sm shrink-0">
                            {formatCurrency(inv.total)}
                          </p>
                        </div>
                        <p
                          className={cn(
                            "text-xs",
                            sel ? "text-background/70" : "text-muted-foreground",
                          )}
                        >
                          {inv.invoice_number ?? "Sem número"} ·{" "}
                          {inv.invoice_date
                            ? formatDate(inv.invoice_date)
                            : "Sem data"}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <ArrowRight className="hidden lg:block h-5 w-5 text-muted-foreground self-start mt-32" />

        {/* Bank tx */}
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Landmark className="h-4 w-4" />
                Movimentos por conciliar
              </h3>
              <span className="text-xs text-muted-foreground">
                {bankTxs.length}
              </span>
            </div>
            {bankTxs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Sem movimentos por conciliar.
              </p>
            ) : (
              <ul className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                {bankTxs.map((tx) => {
                  const sel = selectedTx === tx.id
                  const isDebit = tx.amount < 0
                  return (
                    <li key={tx.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedTx(sel ? null : tx.id)}
                        className={cn(
                          "w-full text-left rounded-md border p-2.5 transition-colors",
                          sel
                            ? "bg-foreground text-background border-foreground"
                            : "bg-background hover:bg-muted/50",
                        )}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="font-medium truncate text-sm">
                            {tx.counterparty_name ??
                              tx.description ??
                              "Sem descrição"}
                          </p>
                          <p
                            className={cn(
                              "font-semibold tabular-nums text-sm shrink-0",
                              !sel &&
                                (isDebit
                                  ? "text-red-700 dark:text-red-400"
                                  : "text-emerald-700 dark:text-emerald-400"),
                            )}
                          >
                            {isDebit ? "−" : "+"}
                            {formatCurrency(Math.abs(tx.amount))}
                          </p>
                        </div>
                        <p
                          className={cn(
                            "text-xs",
                            sel ? "text-background/70" : "text-muted-foreground",
                          )}
                        >
                          {formatDate(tx.date)}
                          {tx.bank_reference && (
                            <>
                              {" · "}ref{" "}
                              <span className="font-mono">
                                {tx.bank_reference}
                              </span>
                            </>
                          )}
                        </p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
