"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import { MovementNote } from "@/components/banco/movement-note"

export type SuggestionRow = {
  reconciliation_id: string
  score: number
  invoice: {
    id: string
    supplier_name: string | null
    invoice_number: string | null
    invoice_date: string | null
    total: number
  }
  bank_tx: {
    id: string
    date: string
    description: string | null
    counterparty_name: string | null
    bank_reference: string | null
    amount: number
    notes: string | null
  }
}

export function MatchCard({ suggestion }: { suggestion: SuggestionRow }) {
  const router = useRouter()
  const [busy, setBusy] = useState<"confirm" | "reject" | null>(null)

  async function decide(action: "confirm" | "reject") {
    setBusy(action)
    const res = await fetch("/api/conciliacao/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        invoice_id: suggestion.invoice.id,
        bank_transaction_id: suggestion.bank_tx.id,
        reconciliation_id: suggestion.reconciliation_id,
      }),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      toast.error(
        action === "confirm" ? "Falha ao confirmar" : "Falha ao rejeitar",
        { description: errBody.error ?? `HTTP ${res.status}` },
      )
      setBusy(null)
      return
    }
    toast.success(action === "confirm" ? "Match confirmado" : "Sugestão rejeitada")
    setBusy(null)
    router.refresh()
  }

  const scorePct = Math.round(suggestion.score * 100)
  const scoreColor =
    suggestion.score >= 0.9
      ? "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200"
      : "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200"

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className={scoreColor}>
            Sugestão IA · {scorePct}%
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDate(suggestion.bank_tx.date)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
          {/* Invoice */}
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Fatura
            </p>
            <p className="font-medium truncate">
              {suggestion.invoice.supplier_name ?? "Fornecedor"}
            </p>
            <p className="text-xs text-muted-foreground">
              {suggestion.invoice.invoice_number ?? "Sem número"} ·{" "}
              {suggestion.invoice.invoice_date
                ? formatDate(suggestion.invoice.invoice_date)
                : "Sem data"}
            </p>
            <p className="text-lg font-semibold tabular-nums mt-1">
              {formatCurrency(suggestion.invoice.total)}
            </p>
          </div>

          <ArrowRight className="hidden sm:block h-4 w-4 text-muted-foreground mx-auto" />

          {/* Bank tx */}
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Movimento
              </p>
              <MovementNote
                id={suggestion.bank_tx.id}
                initialNotes={suggestion.bank_tx.notes}
              />
            </div>
            <p className="font-medium truncate">
              {suggestion.bank_tx.counterparty_name ??
                suggestion.bank_tx.description ??
                "Sem descrição"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(suggestion.bank_tx.date)}
              {suggestion.bank_tx.bank_reference && (
                <>
                  {" · "}ref{" "}
                  <span className="font-mono">
                    {suggestion.bank_tx.bank_reference}
                  </span>
                </>
              )}
            </p>
            <p className="text-lg font-semibold tabular-nums mt-1 text-red-700 dark:text-red-400">
              {formatCurrency(Math.abs(suggestion.bank_tx.amount))}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => decide("reject")}
            disabled={busy !== null}
          >
            {busy === "reject" ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="mr-2 h-3.5 w-3.5" />
            )}
            Rejeitar
          </Button>
          <Button
            size="sm"
            onClick={() => decide("confirm")}
            disabled={busy !== null}
          >
            {busy === "confirm" ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="mr-2 h-3.5 w-3.5" />
            )}
            Confirmar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
