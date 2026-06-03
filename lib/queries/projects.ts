import { createClient } from "@/lib/supabase/server"
import type {
  ProjectStatus,
  ProjectType,
  UserRole,
  VatRegime,
} from "@/types"

export type ProjectListItem = {
  id: string
  name: string
  code: string | null
  description: string | null
  type: ProjectType
  status: ProjectStatus
  color: string
  client_name: string | null
  budget: number | null
  budget_alert_threshold: number
  start_date: string | null
  end_date: string | null
  total_spent: number
  invoice_count: number
}

export type ProjectsFilter = {
  status?: ProjectStatus | "all"
  type?: ProjectType | "all"
}

export async function listProjects(
  tenantId: string,
  options: {
    role: UserRole
    userId: string
    filter?: ProjectsFilter
    vatRegime?: VatRegime
  },
): Promise<ProjectListItem[]> {
  const supabase = createClient()
  const { role, userId, filter, vatRegime = "normal" } = options

  let query = supabase
    .from("projects")
    .select(
      "id, name, code, description, type, status, color, client_name, budget, budget_alert_threshold, start_date, end_date",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })

  if (filter?.status && filter.status !== "all") {
    query = query.eq("status", filter.status)
  }
  if (filter?.type && filter.type !== "all") {
    query = query.eq("type", filter.type)
  }

  if (role === "member") {
    const { data: memberships } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", userId)
    const allowedIds = (memberships ?? []).map((m) => m.project_id)
    if (allowedIds.length === 0) return []
    query = query.in("id", allowedIds)
  }

  const { data: projects } = await query
  const list = projects ?? []
  if (list.length === 0) return []

  const ids = list.map((p) => p.id)
  const { data: invoices } = await supabase
    .from("invoices")
    .select("project_id, total, subtotal")
    .eq("tenant_id", tenantId)
    .in("project_id", ids)
    .neq("status", "rejected")

  const totals = new Map<string, { spent: number; count: number }>()
  for (const row of invoices ?? []) {
    if (!row.project_id) continue
    const t = totals.get(row.project_id) ?? { spent: 0, count: 0 }
    // VAT-aware: if company is exempt, use subtotal (exclude VAT from cost)
    const amount = vatRegime === "isento"
      ? Number(row.subtotal ?? row.total ?? 0)
      : Number(row.total ?? 0)
    t.spent += amount
    t.count += 1
    totals.set(row.project_id, t)
  }

  return list.map((p) => {
    const t = totals.get(p.id) ?? { spent: 0, count: 0 }
    return {
      id: p.id,
      name: p.name,
      code: p.code,
      description: p.description,
      type: (p.type ?? "obra") as ProjectType,
      status: (p.status ?? "active") as ProjectStatus,
      color: p.color ?? "#2563EB",
      client_name: p.client_name,
      budget: p.budget !== null ? Number(p.budget) : null,
      budget_alert_threshold: p.budget_alert_threshold ?? 80,
      start_date: p.start_date,
      end_date: p.end_date,
      total_spent: t.spent,
      invoice_count: t.count,
    }
  })
}
