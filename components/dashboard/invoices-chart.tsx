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
  revenue: { label: "Receita", color: "hsl(var(--chart-1))" },
  expenses: { label: "Gastos", color: "hsl(var(--chart-2))" },
  ebitda: { label: "EBITDA", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig

export function InvoicesChart({ data, year }: { data: ChartPoint[]; year: number }) {
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0)
  const totalExpenses = data.reduce((s, d) => s + d.expenses, 0)
  const totalEbitda = totalRevenue - totalExpenses

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Receita vs Gastos — {year}
        </CardTitle>
        <CardDescription>
          Receita {formatCurrency(totalRevenue)} · Gastos {formatCurrency(totalExpenses)} · EBITDA {formatCurrency(totalEbitda)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <ComposedChart data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
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
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
            <Line
              dataKey="ebitda"
              stroke="var(--color-ebitda)"
              strokeWidth={2}
              dot={false}
              type="monotone"
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
