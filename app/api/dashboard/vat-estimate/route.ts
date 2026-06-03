import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"

function getQuarterMonthRange(quarter: number): { startMonth: number; endMonth: number } {
  const ranges: Record<number, { startMonth: number; endMonth: number }> = {
    1: { startMonth: 1, endMonth: 3 },
    2: { startMonth: 4, endMonth: 6 },
    3: { startMonth: 7, endMonth: 9 },
    4: { startMonth: 10, endMonth: 12 },
  }
  return ranges[quarter] ?? { startMonth: 1, endMonth: 3 }
}

function calcDeadline(periodType: "monthly" | "quarterly", periodEndMonth: number, year: number): string {
  // Deadline: 15th of the month 2 months after the period end
  let deadlineMonth = periodEndMonth + 2
  let deadlineYear = year
  if (deadlineMonth > 12) {
    deadlineMonth -= 12
    deadlineYear += 1
  }
  return `${deadlineYear}-${String(deadlineMonth).padStart(2, "0")}-15`
}

export async function GET(request: Request) {
  const session = await getCurrentSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const periodType = (searchParams.get("period") ?? "monthly") as "monthly" | "quarterly"
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10)
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10)
  const quarter = parseInt(searchParams.get("quarter") ?? String(Math.ceil((new Date().getMonth() + 1) / 3)), 10)

  let startDate: string
  let endDate: string
  let periodEndMonth: number
  let period_label: string

  const PT_MONTHS_LONG = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ]

  if (periodType === "monthly") {
    const lastDay = new Date(year, month, 0).getDate()
    startDate = `${year}-${String(month).padStart(2, "0")}-01`
    endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
    periodEndMonth = month
    period_label = `${PT_MONTHS_LONG[month - 1]} ${year}`
  } else {
    const { startMonth, endMonth } = getQuarterMonthRange(quarter)
    const lastDay = new Date(year, endMonth, 0).getDate()
    startDate = `${year}-${String(startMonth).padStart(2, "0")}-01`
    endDate = `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
    periodEndMonth = endMonth
    period_label = `T${quarter} ${year}`
  }

  const supabase = createClient()

  const { data: invoices } = await supabase
    .from("invoices")
    .select("type, vat_amount")
    .eq("tenant_id", session.tenant.id)
    .gte("invoice_date", startDate)
    .lte("invoice_date", endDate)
    .neq("status", "rejected")

  const iva_liquidado = (invoices ?? [])
    .filter((i) => i.type === "outgoing")
    .reduce((s, i) => s + Number(i.vat_amount ?? 0), 0)

  const iva_dedutivel = (invoices ?? [])
    .filter((i) => i.type === "incoming")
    .reduce((s, i) => s + Number(i.vat_amount ?? 0), 0)

  const iva_a_pagar = iva_liquidado - iva_dedutivel
  const deadline = calcDeadline(periodType, periodEndMonth, year)

  return NextResponse.json({
    iva_a_pagar,
    iva_liquidado,
    iva_dedutivel,
    deadline,
    period_label,
  })
}
