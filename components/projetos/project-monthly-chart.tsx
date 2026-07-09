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
  value: { label: "Gasto", color: "#4E7217" },
} satisfies ChartConfig

export function ProjectMonthlyChart({ data }: { data: ProjectChartPoint[] }) {
  return (
    <Card className="shadow-[var(--shadow-card,none)] border-border/60">
      <CardHeader>
        <CardTitle className="font-display text-sm font-medium">Gastos por mês</CardTitle>
        <CardDescription>Por data da fatura</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-56 w-full">
          <BarChart data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="gradProjectMonthly" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4E7217" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#3DAEAF" stopOpacity={0.85} />
              </linearGradient>
            </defs>
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
            <Bar dataKey="value" fill="url(#gradProjectMonthly)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
