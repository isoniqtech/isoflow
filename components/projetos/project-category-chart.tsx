"use client"

import { Cell, Pie, PieChart } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatCurrency } from "@/lib/utils/portugal"
import type { CategorySlice } from "@/lib/queries/project-detail"

const PALETTE = [
  "hsl(217 91% 60%)",
  "hsl(160 84% 39%)",
  "hsl(38 92% 50%)",
  "hsl(0 84% 60%)",
  "hsl(280 90% 55%)",
  "hsl(190 80% 45%)",
  "hsl(20 90% 55%)",
  "hsl(110 60% 45%)",
]

const CATEGORY_LABELS: Record<string, string> = {
  transporte: "Transporte",
  alimentacao: "Alimentação",
  tecnologia: "Tecnologia",
  servicos: "Serviços",
  material: "Material",
  combustivel: "Combustível",
  comunicacoes: "Comunicações",
  alojamento: "Alojamento",
  formacao: "Formação",
  outro: "Outro",
}

export function ProjectCategoryChart({ data }: { data: CategorySlice[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)

  const config: ChartConfig = data.reduce<ChartConfig>((acc, slice, i) => {
    acc[slice.category] = {
      label: CATEGORY_LABELS[slice.category] ?? slice.category,
      color: PALETTE[i % PALETTE.length],
    }
    return acc
  }, {})

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Distribuição por categoria</CardTitle>
        <CardDescription>{formatCurrency(total)} no total</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
            Sem faturas para mostrar
          </div>
        ) : (
          <>
            <ChartContainer config={config} className="h-56 w-full">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value, name) => (
                        <div className="flex justify-between gap-3 w-full">
                          <span>{CATEGORY_LABELS[name as string] ?? name}</span>
                          <span className="font-medium">
                            {formatCurrency(Number(value))}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="category"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {data.map((slice, i) => (
                    <Cell key={slice.category} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="mt-3 space-y-1 text-xs">
              {data.slice(0, 5).map((slice, i) => (
                <li key={slice.category} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                  />
                  <span className="flex-1 truncate">
                    {CATEGORY_LABELS[slice.category] ?? slice.category}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatCurrency(slice.value)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
