import { createClient } from "@/lib/supabase/server"
import { getInvestidorProjectIds } from "@/lib/queries/investidores"
import type {
  InvoiceSource,
  InvoiceStatus,
  ProjectType,
  ProjectStatus,
  UserRole,
} from "@/types"

export type InvoiceListItem = {
  id: string
  supplier_name: string | null
  supplier_nif: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  total: number | null
  currency: string
  status: InvoiceStatus
  source: InvoiceSource
  type: "incoming" | "outgoing"
  category: string | null
  document_kind: "invoice" | "credit_note"
  needs_review: boolean
  at_communicated: boolean
  efatura_at_status: string | null
  erp_synced: boolean
  erp_document_id: string | null
  toconline_fc_id: string | null
  bank_transaction_id: string | null
  project: { id: string; name: string; color: string } | null
  created_at: string
}

export type InvoicesFilter = {
  status?: InvoiceStatus | "all"
  source?: InvoiceSource | "all"
  project_id?: string | "all" | "none"
  category?: string | "all"
  document_kind?: "all" | "invoice" | "credit_note"
  needs_review?: boolean
  date_from?: string
  date_to?: string
}

export type InvoicesListResult = {
  invoices: InvoiceListItem[]
  total: number
  page: number
  page_size: number
}

export type ProjectOption = {
  id: string
  name: string
  color: string
  type: ProjectType
  status: ProjectStatus
}

const SELECT_FIELDS =
  "id, supplier_name, supplier_nif, invoice_number, invoice_date, due_date, total, currency, status, source, type, category, document_kind, needs_review, at_communicated, erp_synced, erp_document_id, toconline_fc_id, bank_transaction_id, project_id, created_at, efatura_documents(at_status)"

const PAGE_SIZE = 50

function mapRow(
  r: Record<string, unknown>,
  projectMap: Map<string, { id: string; name: string; color: string }>,
): InvoiceListItem {
  const projectId = r.project_id as string | null
  return {
    id: r.id as string,
    supplier_name: (r.supplier_name as string | null) ?? null,
    supplier_nif: (r.supplier_nif as string | null) ?? null,
    invoice_number: (r.invoice_number as string | null) ?? null,
    invoice_date: (r.invoice_date as string | null) ?? null,
    due_date: (r.due_date as string | null) ?? null,
    total: r.total !== null ? Number(r.total) : null,
    currency: (r.currency as string) ?? "EUR",
    status: ((r.status as string) ?? "pending") as InvoiceStatus,
    source: ((r.source as string) ?? "manual") as InvoiceSource,
    type: ((r.type as string) ?? "incoming") as "incoming" | "outgoing",
    category: (r.category as string | null) ?? null,
    document_kind:
      (r.document_kind as string | null) === "credit_note" ? "credit_note" : "invoice",
    needs_review: (r.needs_review as boolean) ?? false,
    at_communicated: (r.at_communicated as boolean) ?? false,
    efatura_at_status: (() => {
      const docs = r.efatura_documents as Array<{ at_status: string | null }> | null
      return docs?.[0]?.at_status ?? null
    })(),
    erp_synced: (r.erp_synced as boolean) ?? false,
    erp_document_id: (r.erp_document_id as string | null) ?? null,
    toconline_fc_id: (r.toconline_fc_id as string | null) ?? null,
    bank_transaction_id: (r.bank_transaction_id as string | null) ?? null,
    project: projectId ? (projectMap.get(projectId) ?? null) : null,
    created_at: (r.created_at as string) ?? new Date().toISOString(),
  }
}

async function fetchProjectMap(
  supabase: ReturnType<typeof createClient>,
  rows: Array<{ project_id?: string | null }>,
): Promise<Map<string, { id: string; name: string; color: string }>> {
  const projectIds = Array.from(
    new Set(rows.map((r) => r.project_id).filter((p): p is string => Boolean(p))),
  )
  const map = new Map<string, { id: string; name: string; color: string }>()
  if (!projectIds.length) return map
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, color")
    .in("id", projectIds)
  for (const p of projects ?? []) {
    map.set(p.id, { id: p.id, name: p.name, color: p.color ?? "#2563EB" })
  }
  return map
}

export async function listInvoices(
  tenantId: string,
  options: {
    role: UserRole
    userId: string
    filter?: InvoicesFilter
    page?: number
  },
): Promise<InvoicesListResult> {
  const supabase = createClient()
  const { role, userId, filter, page = 1 } = options
  const offset = (page - 1) * PAGE_SIZE

  // Investidor: apenas faturas dos projetos onde esta associado
  let investidorProjectIds: string[] | null = null
  if (role === "investidor") {
    investidorProjectIds = await getInvestidorProjectIds(userId)
    if (investidorProjectIds.length === 0) {
      return { invoices: [], total: 0, page, page_size: PAGE_SIZE }
    }
  }

  let query = supabase
    .from("invoices")
    .select(SELECT_FIELDS, { count: "exact" })
    .eq("tenant_id", tenantId)

  if (role === "member") query = query.eq("created_by", userId)
  if (investidorProjectIds) query = query.in("project_id", investidorProjectIds)
  if (filter?.status && filter.status !== "all") {
    // O badge "Em Sistema" agrupa varios estados internos (em_sistema, pending,
    // processing, matched, paid, reconciled) - o filtro tem de apanhar o grupo,
    // senao faturas que MOSTRAM "Em Sistema" mas nao sao exatamente "em_sistema"
    // ficavam de fora. Os restantes estados sao match exato.
    if (filter.status === "em_sistema") {
      query = query.in("status", [
        "em_sistema", "pending", "processing", "matched", "paid", "reconciled",
      ])
    } else {
      query = query.eq("status", filter.status)
    }
  }
  if (filter?.source && filter.source !== "all") query = query.eq("source", filter.source)
  if (filter?.project_id) {
    if (filter.project_id === "none") query = query.is("project_id", null)
    else if (filter.project_id !== "all") query = query.eq("project_id", filter.project_id)
  }
  if (filter?.category && filter.category !== "all") query = query.eq("category", filter.category)
  if (filter?.document_kind && filter.document_kind !== "all") {
    if (filter.document_kind === "credit_note") {
      query = query.eq("document_kind", "credit_note")
    } else {
      // Faturas: tudo o que NAO e' nota de credito (inclui null/"invoice").
      query = query.or("document_kind.is.null,document_kind.neq.credit_note")
    }
  }
  if (filter?.needs_review) query = query.eq("needs_review", true)
  if (filter?.date_from) query = query.gte("invoice_date", filter.date_from)
  if (filter?.date_to) query = query.lte("invoice_date", filter.date_to)

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const rows = (data ?? []) as Array<Record<string, unknown>>
  const projectMap = await fetchProjectMap(supabase, rows as Array<{ project_id?: string | null }>)

  return {
    invoices: rows.map((r) => mapRow(r, projectMap)),
    total: count ?? 0,
    page,
    page_size: PAGE_SIZE,
  }
}

export type EFaturaData = {
  por_enviar: InvoiceListItem[]
  enviadas: InvoiceListItem[]
}

export async function listEFaturaInvoices(
  tenantId: string,
  role: UserRole,
  userId: string,
): Promise<EFaturaData> {
  const supabase = createClient()

  const baseQuery = () => {
    let q = supabase
      .from("invoices")
      .select(SELECT_FIELDS)
      .eq("tenant_id", tenantId)
      .eq("erp_synced", true)
    if (role === "member") q = q.eq("created_by", userId)
    return q
  }

  const [{ data: porEnviarRaw }, { data: enviadasRaw }] = await Promise.all([
    baseQuery()
      .eq("at_communicated", false)
      .neq("status", "rejected")
      .order("invoice_date", { ascending: false })
      .limit(100),
    baseQuery()
      .eq("at_communicated", true)
      .order("at_communicated_at", { ascending: false })
      .limit(50),
  ])

  const allRows = [
    ...((porEnviarRaw ?? []) as Array<Record<string, unknown>>),
    ...((enviadasRaw ?? []) as Array<Record<string, unknown>>),
  ]
  const projectMap = await fetchProjectMap(
    supabase,
    allRows as Array<{ project_id?: string | null }>,
  )

  return {
    por_enviar: (porEnviarRaw ?? []).map((r) =>
      mapRow(r as Record<string, unknown>, projectMap),
    ),
    enviadas: (enviadasRaw ?? []).map((r) =>
      mapRow(r as Record<string, unknown>, projectMap),
    ),
  }
}

export async function listPorConciliarInvoices(
  tenantId: string,
  role: UserRole,
  userId: string,
): Promise<InvoiceListItem[]> {
  const supabase = createClient()

  let query = supabase
    .from("invoices")
    .select(SELECT_FIELDS)
    .eq("tenant_id", tenantId)
    .is("bank_transaction_id", null)
    .not("status", "in", '("rejected","paid","matched","reconciled")')
    .order("invoice_date", { ascending: false })
    .limit(100)

  if (role === "member") query = query.eq("created_by", userId)

  const { data } = await query
  const rows = (data ?? []) as Array<Record<string, unknown>>
  const projectMap = await fetchProjectMap(supabase, rows as Array<{ project_id?: string | null }>)
  return rows.map((r) => mapRow(r, projectMap))
}

export async function listProjectOptions(tenantId: string): Promise<ProjectOption[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("projects")
    .select("id, name, color, type, status")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true })

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color ?? "#2563EB",
    type: (p.type ?? "obra") as ProjectType,
    status: (p.status ?? "active") as ProjectStatus,
  }))
}
