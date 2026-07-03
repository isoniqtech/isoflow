"use client"

import { Users, TrendingUp, CircleDollarSign, CheckCircle } from "lucide-react"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { formatCurrency } from "@/lib/utils/portugal"
import type { InvestidorStats } from "@/lib/queries/investidores"

export function InvestorStats({ stats }: { stats: InvestidorStats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="Total investidores"
        value={stats.total.toString()}
        icon={Users}
        hint={`${stats.em_investimento} em investimento`}
      />
      <KpiCard
        label="Prontos para investir"
        value={stats.prontos.toString()}
        icon={CheckCircle}
        hint="Estado: pronto"
      />
      <KpiCard
        label="Capital disponivel"
        value={formatCurrency(stats.capital_disponivel_total)}
        icon={CircleDollarSign}
        hint="Soma de todos os investidores"
      />
      <KpiCard
        label="Capital alocado"
        value={formatCurrency(stats.capital_alocado_total)}
        icon={TrendingUp}
        hint="Estimado por percentagem de projeto"
      />
    </div>
  )
}
