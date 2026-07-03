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
import type { ProjectChartPoint } from "@/lib/queries/project-detail"

const config = {
  value: { label: "Gasto", color: "hsl(var(--foreground))" },
} satisfies ChartConfig

export function ProjectMonthlyChart({ data }: { data: ProjectChartPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Gastos por mês</CardTitle>
        <CardDescription>Por data da fatura</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-56 w-full">
          <BarChart data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value, _, item) => {
                    const p = item.payload as ProjectChartPoint
                    return (
                      <div className="flex flex-col gap-0.5">
                        <span>{formatCurrency(Number(value))}</span>
                        <span className="text-muted-foreground">
                          {p.count} faturas
                        </span>
                      </div>
                    )
                  }}
                />
              }
            />
            <Bar dataKey="value" fill="var(--color-value)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
