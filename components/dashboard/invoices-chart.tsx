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
  count: {
    label: "Faturas",
    color: "hsl(var(--foreground))",
  },
} satisfies ChartConfig

export function InvoicesChart({ data }: { data: ChartPoint[] }) {
  const totalCount = data.reduce((s, d) => s + d.count, 0)
  const totalValue = data.reduce((s, d) => s + d.value, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Faturas nos últimos 6 meses
        </CardTitle>
        <CardDescription>
          {totalCount.toLocaleString("pt-PT")} faturas · {formatCurrency(totalValue)}
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
                  formatter={(value, name, item) => {
                    if (name === "count") {
                      const valueNumber = (item.payload as ChartPoint).value
                      return (
                        <div className="flex flex-col gap-0.5">
                          <span>{value} faturas</span>
                          <span className="text-muted-foreground">
                            {formatCurrency(valueNumber)}
                          </span>
                        </div>
                      )
                    }
                    return value
                  }}
                />
              }
            />
            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
