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

// Paleta alinhada com o espetro de marca: forest-lt, teal, lime, mint, petrol, abyss, ambar, forest
const PALETTE = [
  "#3DAEAF", // teal
  "#90C765", // lime
  "#1D8192", // petrol
  "#62C099", // mint
  "#4E7217", // forest-lt
  "#FBBF24", // ambar (contraste quente)
  "#0D4961", // abyss
  "#344E0D", // forest
]

// Gradientes SVG por indice de slice (máximo 8 categorias)
const GRADIENTS = [
  { from: "#3DAEAF", to: "#1D8192" }, // teal -> petrol
  { from: "#90C765", to: "#62C099" }, // lime -> mint
  { from: "#1D8192", to: "#0D4961" }, // petrol -> abyss
  { from: "#62C099", to: "#3DAEAF" }, // mint -> teal
  { from: "#4E7217", to: "#3DAEAF" }, // forest-lt -> teal
  { from: "#FBBF24", to: "#F59E0B" }, // ambar
  { from: "#0D4961", to: "#1D8192" }, // abyss -> petrol
  { from: "#344E0D", to: "#4E7217" }, // forest -> forest-lt
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
    <Card className="shadow-[var(--shadow-card,none)] border-border/60">
      <CardHeader>
        <CardTitle className="font-display text-sm font-medium">Distribuição por categoria</CardTitle>
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
                <defs>
                  {GRADIENTS.map((g, i) => (
                    <radialGradient key={i} id={`gradSlice${i}`} cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor={g.from} stopOpacity={1} />
                      <stop offset="100%" stopColor={g.to} stopOpacity={0.85} />
                    </radialGradient>
                  ))}
                </defs>
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
                    <Cell
                      key={slice.category}
                      fill={`url(#gradSlice${i % GRADIENTS.length})`}
                      stroke="hsl(var(--card))"
                      strokeWidth={1.5}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="mt-3 space-y-1 text-xs">
              {data.slice(0, 5).map((slice, i) => (
                <li key={slice.category} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-sm shrink-0"
                    style={{ background: `linear-gradient(135deg, ${GRADIENTS[i % GRADIENTS.length].from}, ${GRADIENTS[i % GRADIENTS.length].to})` }}
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
