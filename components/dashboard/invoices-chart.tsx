"use client"

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatCurrency } from "@/lib/utils/portugal"
import type { ChartPoint } from "@/lib/queries/dashboard"

const chartConfig = {
  revenue:  { label: "Receita",  color: "#3DAEAF" },
  expenses: { label: "Gastos",   color: "#FBBF24" },
  ebitda:   { label: "EBITDA",   color: "#62C099" },
} satisfies ChartConfig

export function InvoicesChart({ data, year }: { data: ChartPoint[]; year: number }) {
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0)
  const totalExpenses = data.reduce((s, d) => s + d.expenses, 0)
  const totalEbitda = totalRevenue - totalExpenses

  return (
    <Card className="shadow-[var(--shadow-card,none)] border-border/60">
      <CardHeader>
        <CardTitle className="text-sm font-medium font-display">
          Receita vs Gastos {year}
        </CardTitle>
        <CardDescription>
          Receita {formatCurrency(totalRevenue)} · Gastos {formatCurrency(totalExpenses)} · EBITDA {formatCurrency(totalEbitda)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <ComposedChart data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
            {/* SVG gradient definitions for bars */}
            <defs>
              <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3DAEAF" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#1D8192" stopOpacity={0.85} />
              </linearGradient>
              <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FBBF24" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#D97706" stopOpacity={0.85} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    const labels: Record<string, string> = {
                      revenue: "Receita",
                      expenses: "Gastos",
                      ebitda: "EBITDA",
                    }
                    return `${labels[name as string] ?? name}: ${formatCurrency(Number(value))}`
                  }}
                />
              }
            />
            <Bar dataKey="revenue" fill="url(#gradRevenue)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" fill="url(#gradExpenses)" radius={[4, 4, 0, 0]} />
            <Line
              dataKey="ebitda"
              stroke="#62C099"
              strokeWidth={2.5}
              dot={false}
              type="monotone"
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
