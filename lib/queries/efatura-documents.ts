import { createClient } from "@/lib/supabase/server"
import type { UserRole } from "@/types"

export type EFaturaDocument = {
  id: string
  toconline_id: string | null
  at_document_id: string | null
  document_number: string | null
  document_date: string | null
  supplier_nif: string | null
  supplier_name: string | null
  total: number | null
  subtotal: number | null
  vat_amount: number | null
  currency: string
  at_status: string | null
  invoice_id: string | null
  matched_at: string | null
  matched_by: "auto" | "manual" | null
}

export type EFaturaPageData = {
  // Faturas sem FC (passo 1 — criar FC no Toconline)
  sem_fc: import("@/lib/queries/invoices").InvoiceListItem[]
  // Faturas com FC mas ainda não cruzadas com e-Fatura (passo 2 — split view)
  com_fc: import("@/lib/queries/invoices").InvoiceListItem[]
  // Documentos e-Fatura vindos do AT (lado direito do split)
  efatura_docs: EFaturaDocument[]
  // Faturas já associadas ao e-Fatura (arquivo)
  associadas: import("@/lib/queries/invoices").InvoiceListItem[]
}

export async function listEFaturaPageData(
  tenantId: string,
  role: UserRole,
  userId: string,
): Promise<EFaturaPageData> {
  const { createClient: create } = await import("@/lib/supabase/server")
  const supabase = create()

  const SELECT_FIELDS =
    "id, supplier_name, supplier_nif, invoice_number, invoice_date, due_date, total, currency, status, source, type, category, needs_review, at_communicated, erp_synced, erp_document_id, toconline_fc_id, bank_transaction_id, project_id, created_at"

  const baseInvoices = () => {
    let q = supabase
      .from("invoices")
      .select(SELECT_FIELDS)
      .eq("tenant_id", tenantId)
      .eq("type", "incoming")
      .neq("status", "rejected")
    if (role === "member") q = q.eq("created_by", userId)
    return q
  }

  const [semFcRes, comFcRes, associadasRes, efaturaDocsRes] = await Promise.all([
    // Sem FC
    baseInvoices()
      .is("toconline_fc_id", null)
      .order("invoice_date", { ascending: false })
      .limit(100),

    // Com FC mas não associadas ao e-Fatura (at_communicated = false)
    baseInvoices()
      .not("toconline_fc_id", "is", null)
      .eq("at_communicated", false)
      .order("invoice_date", { ascending: false })
      .limit(100),

    // Já associadas ao e-Fatura
    baseInvoices()
      .not("toconline_fc_id", "is", null)
      .eq("at_communicated", true)
      .order("invoice_date", { ascending: false })
      .limit(50),

    // Documentos e-Fatura sem match (lado direito do split)
    supabase
      .from("efatura_documents")
      .select("id, toconline_id, at_document_id, document_number, document_date, supplier_nif, supplier_name, total, subtotal, vat_amount, currency, at_status, invoice_id, matched_at, matched_by")
      .eq("tenant_id", tenantId)
      .is("invoice_id", null)
      .order("document_date", { ascending: false })
      .limit(200),
  ])

  // Importar mapRow e fetchProjectMap dinamicamente para não duplicar código
  const { listInvoices: _ } = await import("@/lib/queries/invoices")
  const { createClient: c2 } = await import("@/lib/supabase/server")
  const sb2 = c2()

  // Montar projectMap para os três conjuntos de faturas
  const allRows = [
    ...((semFcRes.data ?? []) as Array<{ project_id?: string | null }>),
    ...((comFcRes.data ?? []) as Array<{ project_id?: string | null }>),
    ...((associadasRes.data ?? []) as Array<{ project_id?: string | null }>),
  ]
  const projectIds = Array.from(
    new Set(allRows.map((r) => r.project_id).filter((p): p is string => Boolean(p))),
  )
  const projectMap = new Map<string, { id: string; name: string; color: string }>()
  if (projectIds.length) {
    const { data: projects } = await sb2
      .from("projects")
      .select("id, name, color")
      .in("id", projectIds)
    for (const p of projects ?? []) {
      projectMap.set(p.id, { id: p.id, name: p.name, color: p.color ?? "#2563EB" })
    }
  }

  function mapRow(r: Record<string, unknown>) {
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
      status: (r.status as string) as import("@/types").InvoiceStatus,
      source: (r.source as string) as import("@/types").InvoiceSource,
      type: (r.type as "incoming" | "outgoing") ?? "incoming",
      category: (r.category as string | null) ?? null,
      needs_review: (r.needs_review as boolean) ?? false,
      at_communicated: (r.at_communicated as boolean) ?? false,
      erp_synced: (r.erp_synced as boolean) ?? false,
      erp_document_id: (r.erp_document_id as string | null) ?? null,
      toconline_fc_id: (r.toconline_fc_id as string | null) ?? null,
      bank_transaction_id: (r.bank_transaction_id as string | null) ?? null,
      project: projectId ? (projectMap.get(projectId) ?? null) : null,
      created_at: (r.created_at as string) ?? new Date().toISOString(),
    }
  }

  const efaturaDocs: EFaturaDocument[] = (efaturaDocsRes.data ?? []).map((d) => ({
    id: d.id,
    toconline_id: d.toconline_id ?? null,
    at_document_id: d.at_document_id ?? null,
    document_number: d.document_number ?? null,
    document_date: d.document_date ?? null,
    supplier_nif: d.supplier_nif ?? null,
    supplier_name: d.supplier_name ?? null,
    total: d.total !== null ? Number(d.total) : null,
    subtotal: d.subtotal !== null ? Number(d.subtotal) : null,
    vat_amount: d.vat_amount !== null ? Number(d.vat_amount) : null,
    currency: d.currency ?? "EUR",
    at_status: d.at_status ?? null,
    invoice_id: d.invoice_id ?? null,
    matched_at: d.matched_at ?? null,
    matched_by: (d.matched_by as "auto" | "manual" | null) ?? null,
  }))

  return {
    sem_fc: (semFcRes.data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
    com_fc: (comFcRes.data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
    associadas: (associadasRes.data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
    efatura_docs: efaturaDocs,
  }
}
