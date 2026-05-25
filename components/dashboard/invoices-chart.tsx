"use client"

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
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
  revenue: {
    label: "Receita",
    color: "hsl(var(--chart-1))",
  },
  expenses: {
    label: "Gastos",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export function InvoicesChart({ data }: { data: ChartPoint[] }) {
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0)
  const totalExpenses = data.reduce((s, d) => s + d.expenses, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Receita vs Gastos — 6 meses
        </CardTitle>
        <CardDescription>
          Receita {formatCurrency(totalRevenue)} · Gastos {formatCurrency(totalExpenses)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-56 w-full">
          <BarChart data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
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
                    const label = name === "revenue" ? "Receita" : "Gastos"
                    return `${label}: ${formatCurrency(Number(value))}`
                  }}
                />
              }
            />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
