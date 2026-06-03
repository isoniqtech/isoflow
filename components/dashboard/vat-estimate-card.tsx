"use client"

import { useEffect, useState } from "react"
import { Calendar, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency, formatDate } from "@/lib/utils/portugal"
import type { VatRegime } from "@/types"

const PT_MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

type EstimateData = {
  iva_a_pagar: number
  iva_liquidado: number
  iva_dedutivel: number
  deadline: string
  period_label: string
}

export function VatEstimateCard({ vatRegime }: { vatRegime: VatRegime }) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentQuarter = Math.ceil(currentMonth / 3)

  const [periodicidade, setPeriodicidade] = useState<"mensal" | "trimestral">("mensal")
  const [month, setMonth] = useState(currentMonth)
  const [quarter, setQuarter] = useState(currentQuarter)
  const [year] = useState(currentYear)
  const [data, setData] = useState<EstimateData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (vatRegime === "isento") return

    setLoading(true)
    const params = new URLSearchParams({
      period: periodicidade === "mensal" ? "monthly" : "quarterly",
      year: String(year),
      ...(periodicidade === "mensal" ? { month: String(month) } : { quarter: String(quarter) }),
    })

    fetch(`/api/dashboard/vat-estimate?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [periodicidade, month, quarter, year, vatRegime])

  const years = Array.from({ length: 3 }, (_, i) => currentYear - i)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            Estimativa IVA
          </CardTitle>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Select value={periodicidade} onValueChange={(v) => setPeriodicidade(v as "mensal" | "trimestral")}>
              <SelectTrigger className="h-7 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="trimestral">Trimestral</SelectItem>
              </SelectContent>
            </Select>

            {periodicidade === "mensal" ? (
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="h-7 text-xs w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PT_MONTHS.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v))}>
                <SelectTrigger className="h-7 text-xs w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">T1</SelectItem>
                  <SelectItem value="2">T2</SelectItem>
                  <SelectItem value="3">T3</SelectItem>
                  <SelectItem value="4">T4</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {vatRegime === "isento" ? (
          <div className="text-sm text-muted-foreground py-1">
            Empresa isenta de IVA — sem estimativa
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            A calcular…
          </div>
        ) : data ? (
          <div className="space-y-2">
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {formatCurrency(data.iva_a_pagar)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                IVA estimado a entregar — {data.period_label}
              </p>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5 border-t pt-2">
              <div className="flex justify-between">
                <span>IVA liquidado (vendas)</span>
                <span className="tabular-nums font-medium text-foreground">{formatCurrency(data.iva_liquidado)}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA dedutível (compras)</span>
                <span className="tabular-nums font-medium text-foreground">{formatCurrency(data.iva_dedutivel)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-md px-2 py-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>Prazo estimado: <strong>{formatDate(data.deadline)}</strong></span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-1">Sem dados para o período</p>
        )}
      </CardContent>
    </Card>
  )
}
