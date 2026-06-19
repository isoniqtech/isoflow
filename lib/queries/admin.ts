import { createAdminClient } from "@/lib/supabase/admin"
import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
  TenantPlan,
  TenantStatus,
} from "@/types"

const PLAN_PRICES: Record<TenantPlan, number> = {
  starter: 79,
  business: 179,
  pro: 349,
  enterprise: 599,
}

export type AdminOverview = {
  tenants_total: number
  tenants_active: number
  tenants_trial: number
  new_tenants_this_month: number
  open_tickets: number
  mrr_total: number
  alerts: Array<{
    id: string
    level: "warn" | "danger"
    title: string
    description: string
    href?: string
  }>
  revenue_by_plan: Array<{ plan: TenantPlan; count: number; mrr: number }>
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = createAdminClient()

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [{ data: tenants }, { data: openTickets }] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, plan, status, credits_balance, created_at"),
    supabase
      .from("support_tickets")
      .select("id")
      .in("status", ["open", "in_progress", "waiting_client"]),
  ])

  const tenantsList = tenants ?? []
  const tenants_total = tenantsList.length
  const tenants_active = tenantsList.filter((t) => t.status === "active").length
  const tenants_trial = tenantsList.filter((t) => t.status === "trial").length
  const new_tenants_this_month = tenantsList.filter(
    (t) =>
      t.created_at && new Date(t.created_at) >= startOfMonth,
  ).length

  const superAdminUserId = process.env.SUPER_ADMIN_USER_ID
  let isoniqTenantId: string | null = null
  if (superAdminUserId) {
    const { data: adminProfile } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", superAdminUserId)
      .maybeSingle()
    isoniqTenantId = adminProfile?.tenant_id ?? null
  }

  const mrrPlanMap = new Map<TenantPlan, { count: number; mrr: number }>()
  let mrr_total = 0
  for (const t of tenantsList) {
    if (t.status !== "active") continue
    if (t.id === isoniqTenantId) continue
    const plan = (t.plan ?? "starter") as TenantPlan
    const price = PLAN_PRICES[plan] ?? 0
    mrr_total += price
    const existing = mrrPlanMap.get(plan) ?? { count: 0, mrr: 0 }
    existing.count += 1
    existing.mrr += price
    mrrPlanMap.set(plan, existing)
  }

  const revenue_by_plan = (
    ["starter", "business", "pro", "enterprise"] as TenantPlan[]
  ).map((plan) => ({
    plan,
    count: mrrPlanMap.get(plan)?.count ?? 0,
    mrr: mrrPlanMap.get(plan)?.mrr ?? 0,
  }))

  const alerts: AdminOverview["alerts"] = []
  const tenantsZeroCredits = tenantsList.filter(
    (t) => t.status === "active" && (t.credits_balance ?? 0) === 0,
  )
  if (tenantsZeroCredits.length > 0) {
    alerts.push({
      id: "zero-credits",
      level: "danger",
      title: `${tenantsZeroCredits.length} cliente(s) sem créditos`,
      description: "Não conseguem processar faturas. Considera contactá-los.",
      href: "/admin/clientes?credits=zero",
    })
  }
  const suspended = tenantsList.filter((t) => t.status === "suspended").length
  if (suspended > 0) {
    alerts.push({
      id: "suspended",
      level: "warn",
      title: `${suspended} cliente(s) suspenso(s)`,
      description: "Verifica se há subscrições falhadas a precisar atenção.",
      href: "/admin/clientes?status=suspended",
    })
  }

  return {
    tenants_total,
    tenants_active,
    tenants_trial,
    new_tenants_this_month,
    open_tickets: (openTickets ?? []).length,
    mrr_total,
    alerts,
    revenue_by_plan,
  }
}

export type AdminClientRow = {
  id: string
  name: string
  nif: string | null
  email: string | null
  plan: TenantPlan
  status: TenantStatus
  credits_balance: number
  created_at: string
  trial_ends_at: string | null
  open_tickets: number
  mrr: number
}

export type AdminClientsFilter = {
  status?: TenantStatus | "all"
  plan?: TenantPlan | "all"
  credits?: "zero" | "low" | "all"
  q?: string
}

export async function listAdminClients(
  filter?: AdminClientsFilter,
): Promise<AdminClientRow[]> {
  const supabase = createAdminClient()

  let query = supabase
    .from("tenants")
    .select(
      "id, name, nif, email, plan, status, credits_balance, created_at, trial_ends_at",
    )
    .order("created_at", { ascending: false })

  if (filter?.status && filter.status !== "all") {
    query = query.eq("status", filter.status)
  }
  if (filter?.plan && filter.plan !== "all") {
    query = query.eq("plan", filter.plan)
  }
  if (filter?.credits === "zero") {
    query = query.eq("credits_balance", 0)
  } else if (filter?.credits === "low") {
    query = query.lt("credits_balance", 100)
  }
  if (filter?.q) {
    query = query.ilike("name", `%${filter.q}%`)
  }

  const { data: tenants } = await query
  const tenantsList = tenants ?? []
  if (tenantsList.length === 0) return []

  const tenantIds = tenantsList.map((t) => t.id)
  const { data: ticketRows } = await supabase
    .from("support_tickets")
    .select("tenant_id")
    .in("tenant_id", tenantIds)
    .in("status", ["open", "in_progress", "waiting_client"])

  const ticketCounts = new Map<string, number>()
  for (const row of ticketRows ?? []) {
    ticketCounts.set(row.tenant_id, (ticketCounts.get(row.tenant_id) ?? 0) + 1)
  }

  return tenantsList.map((t) => {
    const plan = (t.plan ?? "starter") as TenantPlan
    return {
      id: t.id,
      name: t.name,
      nif: t.nif,
      email: t.email,
      plan,
      status: (t.status ?? "trial") as TenantStatus,
      credits_balance: t.credits_balance ?? 0,
      created_at: t.created_at ?? new Date().toISOString(),
      trial_ends_at: t.trial_ends_at,
      open_tickets: ticketCounts.get(t.id) ?? 0,
      mrr: t.status === "active" ? PLAN_PRICES[plan] : 0,
    }
  })
}

export type AdminClientDetail = {
  tenant: {
    id: string
    name: string
    nif: string | null
    email: string | null
    phone: string | null
    address: string | null
    plan: TenantPlan
    status: TenantStatus
    billing_cycle: "monthly" | "annual"
    credits_balance: number
    credits_used_this_month: number
    trial_ends_at: string | null
    next_billing_date: string | null
    onboarding_completed: boolean
    internal_notes: string | null
    created_at: string
  }
  owner: { id: string; name: string; email: string; last_login_at: string | null } | null
  user_count: number
  invoice_count: number
  project_count: number
  integration_count: number
  open_tickets: number
  recent_tickets: Array<{
    id: string
    title: string
    status: SupportTicketStatus
    priority: SupportTicketPriority
    created_at: string
  }>
}

export async function getAdminClientDetail(
  id: string,
): Promise<AdminClientDetail | null> {
  const supabase = createAdminClient()
  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (!tenant) return null

  const [{ data: owner }, { count: user_count }, { count: invoice_count }, { count: project_count }, { count: integration_count }, { data: ticketRows }] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, name, email, last_login_at")
        .eq("tenant_id", id)
        .eq("role", "owner")
        .maybeSingle(),
      supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", id),
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", id),
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", id),
      supabase
        .from("tenant_integrations")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", id)
        .eq("is_active", true),
      supabase
        .from("support_tickets")
        .select("id, title, status, priority, created_at")
        .eq("tenant_id", id)
        .order("updated_at", { ascending: false })
        .limit(5),
    ])

  const open_tickets = (ticketRows ?? []).filter(
    (t) =>
      t.status === "open" ||
      t.status === "in_progress" ||
      t.status === "waiting_client",
  ).length

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      nif: tenant.nif,
      email: tenant.email,
      phone: tenant.phone,
      address: tenant.address,
      plan: (tenant.plan ?? "starter") as TenantPlan,
      status: (tenant.status ?? "trial") as TenantStatus,
      billing_cycle: (tenant.billing_cycle ?? "monthly") as "monthly" | "annual",
      credits_balance: tenant.credits_balance ?? 0,
      credits_used_this_month: tenant.credits_used_this_month ?? 0,
      trial_ends_at: tenant.trial_ends_at,
      next_billing_date: tenant.next_billing_date ?? null,
      onboarding_completed: tenant.onboarding_completed ?? false,
      internal_notes: tenant.internal_notes ?? null,
      created_at: tenant.created_at ?? new Date().toISOString(),
    },
    owner: owner
      ? { id: owner.id, name: owner.name, email: owner.email, last_login_at: owner.last_login_at ?? null }
      : null,
    user_count: user_count ?? 0,
    invoice_count: invoice_count ?? 0,
    project_count: project_count ?? 0,
    integration_count: integration_count ?? 0,
    open_tickets,
    recent_tickets: (ticketRows ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      status: (t.status ?? "open") as SupportTicketStatus,
      priority: (t.priority ?? "medium") as SupportTicketPriority,
      created_at: t.created_at ?? new Date().toISOString(),
    })),
  }
}

export type AdminTicketRow = {
  id: string
  title: string
  status: SupportTicketStatus
  priority: SupportTicketPriority
  category: SupportTicketCategory | null
  credits_charged: number
  created_at: string
  updated_at: string
  tenant: { id: string; name: string }
  creator: { id: string; name: string; email: string }
  message_count: number
}

export type AdminTicketsFilter = {
  status?: SupportTicketStatus | "all"
  priority?: SupportTicketPriority | "all"
  tenant_id?: string
}

export async function listAdminTickets(
  filter?: AdminTicketsFilter,
): Promise<AdminTicketRow[]> {
  const supabase = createAdminClient()

  let query = supabase
    .from("support_tickets")
    .select(
      "id, title, status, priority, category, credits_charged, created_at, updated_at, tenant_id, created_by",
    )
    .order("updated_at", { ascending: false })
    .limit(100)

  if (filter?.status && filter.status !== "all") {
    query = query.eq("status", filter.status)
  }
  if (filter?.priority && filter.priority !== "all") {
    query = query.eq("priority", filter.priority)
  }
  if (filter?.tenant_id) {
    query = query.eq("tenant_id", filter.tenant_id)
  }

  const { data: tickets } = await query
  const list = tickets ?? []
  if (list.length === 0) return []

  const tenantIds = Array.from(new Set(list.map((t) => t.tenant_id)))
  const userIds = Array.from(new Set(list.map((t) => t.created_by)))
  const ticketIds = list.map((t) => t.id)

  const [{ data: tenants }, { data: users }, { data: messages }] =
    await Promise.all([
      supabase.from("tenants").select("id, name").in("id", tenantIds),
      supabase.from("users").select("id, name, email").in("id", userIds),
      supabase.from("support_messages").select("ticket_id").in("ticket_id", ticketIds),
    ])

  const tenantMap = new Map((tenants ?? []).map((t) => [t.id, t]))
  const userMap = new Map((users ?? []).map((u) => [u.id, u]))
  const counts = new Map<string, number>()
  for (const m of messages ?? []) {
    counts.set(m.ticket_id, (counts.get(m.ticket_id) ?? 0) + 1)
  }

  return list.map((t) => {
    const tenant = tenantMap.get(t.tenant_id)
    const user = userMap.get(t.created_by)
    return {
      id: t.id,
      title: t.title,
      status: (t.status ?? "open") as SupportTicketStatus,
      priority: (t.priority ?? "medium") as SupportTicketPriority,
      category: (t.category ?? null) as SupportTicketCategory | null,
      credits_charged: t.credits_charged ?? 0,
      created_at: t.created_at ?? new Date().toISOString(),
      updated_at: t.updated_at ?? new Date().toISOString(),
      tenant: { id: t.tenant_id, name: tenant?.name ?? "—" },
      creator: {
        id: t.created_by,
        name: user?.name ?? "—",
        email: user?.email ?? "",
      },
      message_count: counts.get(t.id) ?? 0,
    }
  })
}

export { PLAN_PRICES }

export type AdminAuditEntry = {
  id: string
  action: string
  resource_type: string | null
  resource_id: string | null
  metadata: Record<string, unknown>
  user: { id: string; name: string; email: string } | null
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  "project.created": "Projeto criado",
  "project.updated": "Projeto atualizado",
  "project.deleted": "Projeto apagado",
  "invoice.created": "Fatura criada",
  "invoice.updated": "Fatura atualizada",
  "invoice.deleted": "Fatura apagada",
  "ticket.opened": "Ticket aberto",
  "ticket.updated": "Ticket atualizado",
  "credits.bonus": "Créditos ajustados (admin)",
  "tenant.admin_updated": "Tenant editado (admin)",
}

export function adminActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

export async function listAdminAudit(
  tenantId: string,
  options?: { limit?: number },
): Promise<AdminAuditEntry[]> {
  const supabase = createAdminClient()
  const limit = options?.limit ?? 30

  const { data: rows } = await supabase
    .from("audit_logs")
    .select("id, action, resource_type, resource_id, metadata, user_id, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit)

  const list = rows ?? []
  if (list.length === 0) return []

  const userIds = Array.from(
    new Set(list.map((r) => r.user_id).filter((id): id is string => Boolean(id))),
  )
  let users: Map<string, { id: string; name: string; email: string }> = new Map()
  if (userIds.length > 0) {
    const { data: userRows } = await supabase
      .from("users")
      .select("id, name, email")
      .in("id", userIds)
    users = new Map((userRows ?? []).map((u) => [u.id, u]))
  }

  return list.map((r) => ({
    id: r.id,
    action: r.action,
    resource_type: r.resource_type,
    resource_id: r.resource_id,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    user: r.user_id ? users.get(r.user_id) ?? null : null,
    created_at: r.created_at ?? new Date().toISOString(),
  }))
}
