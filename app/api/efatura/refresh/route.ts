import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { getValidToken } from "@/lib/toconline/token"
import { fetchDocumentAssociations } from "@/lib/integrations/toconline"

export const runtime = "nodejs"
export const maxDuration = 300

const AT_POSITIVE = ["compra_registada", "Associada", "doc_contabilidade"]

export async function POST(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "faturas", "edit")) return jsonError("Forbidden", 403)

  // Quantos meses buscar (modo direto). Default 2 = mes atual + anterior
  // (comportamento do "Atualizar", inalterado). O "Importar historico" envia
  // um valor maior. Sem body (chamada do "Atualizar") mantem o default.
  let months = 2
  try {
    const body = (await req.json()) as { months?: number } | null
    if (body?.months && Number.isFinite(body.months)) {
      months = Math.min(Math.max(Math.trunc(body.months), 1), 24)
    }
  } catch {
    // sem body -> mantem default 2
  }

  const { createServiceClient } = await import("@/lib/supabase/server")
  const supabase = createServiceClient()

  // Verificar modo de integração do tenant
  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("integration_mode")
    .eq("id", ctx.tenantId)
    .maybeSingle()
  const isDirectMode = (tenantRow as { integration_mode?: string } | null)?.integration_mode === "toconline_direct"

  // ── A) Buscar dados frescos do TOConline ─────────────────────────────────
  let n8nTriggered = false
  let n8nError: string | null = null
  let directFetched = 0

  if (isDirectMode) {
    // Modo directo: buscar de document_associations (appBase = app13)
    try {
      const tokenConfig = await getValidToken(ctx.tenantId)
      const now = new Date()
      // Buscar os ultimos `months` meses (default 2 = mes actual + anterior)
      const ranges: Array<{ from: string; to: string }> = []
      for (let i = 0; i < months; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const firstDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        const lastDayStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`
        ranges.push({ from: firstDay, to: lastDayStr })
      }

      for (const range of ranges) {
        const docs = await fetchDocumentAssociations(
          tokenConfig.accessToken,
          tokenConfig.appBase,
          range.from,
          range.to,
        )

        for (const doc of docs) {
          if (!doc.document_number) continue
          const toconlineId = String(doc.id)
          await supabase.from("efatura_documents").upsert(
            {
              tenant_id: ctx.tenantId,
              toconline_id: toconlineId,
              document_number: doc.document_number,
              document_date: doc.date,
              supplier_name: doc.supplier_name,
              supplier_nif: doc.supplier_nif,
              total: doc.total,
              currency: "EUR",
              at_status: doc.at_status,
              raw_data: doc as unknown as Record<string, unknown>,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id,toconline_id", ignoreDuplicates: false },
          )
          directFetched++
        }
      }
    } catch (e) {
      n8nError = `Direct fetch: ${e instanceof Error ? e.message : String(e)}`
    }
  } else {
    // Modo n8n: disparar webhook para o n8n ir buscar e fazer POST a /api/efatura/sync
    const n8nUrl = process.env.EFATURA_SYNC_WEBHOOK_URL
    if (n8nUrl) {
      try {
        const n8nRes = await fetch(n8nUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenant_id: ctx.tenantId }),
          signal: AbortSignal.timeout(15000),
        })
        n8nTriggered = n8nRes.ok
        if (!n8nRes.ok) n8nError = `n8n HTTP ${n8nRes.status}`
      } catch (e) {
        n8nError = e instanceof Error ? e.message : "n8n timeout"
      }
    }
  }

  // ── B) Reconciliação: efatura_documents ↔ invoices ───────────────────────
  // 1. Buscar todos os docs sem invoice_id e com NIF
  const { data: unmatchedDocs } = await supabase
    .from("efatura_documents")
    .select("id, supplier_nif, document_number, at_status, total")
    .eq("tenant_id", ctx.tenantId)
    .is("invoice_id", null)
    .not("document_number", "is", null)
    .limit(1000)

  let matched = 0
  let atUpdated = 0

  if (unmatchedDocs && unmatchedDocs.length > 0) {
    // 2. Buscar todas as invoices do tenant (incluindo as sem NIF)
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, supplier_nif, invoice_number, toconline_fc_id, total, at_communicated")
      .eq("tenant_id", ctx.tenantId)
      .neq("status", "rejected")

    // Indexar por NIF e também ter lista completa para fallback sem NIF
    const invoicesByNif = new Map<string, typeof invoices>()
    for (const inv of invoices ?? []) {
      if (!inv.supplier_nif) continue
      const list = invoicesByNif.get(inv.supplier_nif) ?? []
      list.push(inv)
      invoicesByNif.set(inv.supplier_nif, list)
    }
    const allInvoices = invoices ?? []

    // 3. Fazer match em memória e batch update
    const efaturaUpdates: { id: string; invoice_id: string }[] = []
    const invoiceAtUpdates: string[] = []

    for (const doc of unmatchedDocs) {
      if (!doc.document_number) continue
      const docTotal = Number(doc.total ?? 0)

      // Candidatos: se doc tem NIF, filtrar por NIF; senão, usar todos
      const candidates = doc.supplier_nif
        ? (invoicesByNif.get(doc.supplier_nif) ?? [])
        : allInvoices

      const inv = candidates.find(
        i =>
          (i.invoice_number === doc.document_number || i.toconline_fc_id === doc.document_number) &&
          Math.abs(Number(i.total ?? 0) - docTotal) < 0.01,
      )
      if (!inv) continue

      efaturaUpdates.push({ id: doc.id, invoice_id: inv.id })
      matched++

      if (AT_POSITIVE.includes(doc.at_status ?? "") && !inv.at_communicated) {
        invoiceAtUpdates.push(inv.id)
        atUpdated++
      }
    }

    // 4. Persistir
    for (const u of efaturaUpdates) {
      await supabase
        .from("efatura_documents")
        .update({ invoice_id: u.invoice_id, matched_at: new Date().toISOString(), matched_by: "auto" })
        .eq("id", u.id)
    }

    if (invoiceAtUpdates.length > 0) {
      await supabase
        .from("invoices")
        .update({ at_communicated: true, at_communicated_at: new Date().toISOString() })
        .in("id", invoiceAtUpdates)
    }
  }

  // 5. Garantir at_communicated nos docs já ligados (cleanup)
  const { data: linkedDocs } = await supabase
    .from("efatura_documents")
    .select("invoice_id, at_status")
    .eq("tenant_id", ctx.tenantId)
    .not("invoice_id", "is", null)
    .in("at_status", AT_POSITIVE)
    .limit(500)

  if (linkedDocs && linkedDocs.length > 0) {
    const linkedIds = linkedDocs.map(d => d.invoice_id).filter(Boolean) as string[]
    const { data: linkedInvoices } = await supabase
      .from("invoices")
      .select("id, at_communicated")
      .in("id", linkedIds)
      .eq("at_communicated", false)

    if (linkedInvoices && linkedInvoices.length > 0) {
      await supabase
        .from("invoices")
        .update({ at_communicated: true, at_communicated_at: new Date().toISOString() })
        .in("id", linkedInvoices.map(i => i.id))
      atUpdated += linkedInvoices.length
    }
  }

  return Response.json({
    n8n_triggered: n8nTriggered,
    n8n_error: n8nError,
    direct_fetched: directFetched,
    matched,
    at_communicated_updated: atUpdated,
  })
}
