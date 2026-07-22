/**
 * ROTA TEMPORÁRIA DE DIAGNÓSTICO - remover após identificar o erro do FC.
 * Só super-admin. Reproduz os passos da criação de FC no TOConline para uma
 * fatura, devolvendo a resposta crua de cada passo.
 *
 * Por defeito é READ-ONLY (dedup + fornecedor + payload que seria enviado).
 * Só com ?post=1 é que tenta mesmo criar a FC (para capturar o erro real).
 */
import { getApiContext, jsonError } from "@/lib/api/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { getValidToken } from "@/lib/toconline/token"

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (process.env.SUPER_ADMIN_USER_ID !== ctx.userId) return jsonError("Forbidden", 403)

  const { searchParams } = new URL(req.url)
  const invoiceId = searchParams.get("invoice")
  const doPost = searchParams.get("post") === "1"
  if (!invoiceId) return Response.json({ error: "falta ?invoice=<uuid>" })

  const admin = createAdminClient()
  const { data: inv } = await admin
    .from("invoices")
    .select("id, tenant_id, supplier_name, supplier_nif, invoice_number, invoice_date, subtotal, vat_rate, total, description")
    .eq("id", invoiceId)
    .maybeSingle()

  if (!inv) return Response.json({ error: "fatura nao encontrada" })

  let t: Awaited<ReturnType<typeof getValidToken>>
  try {
    t = await getValidToken(inv.tenant_id as string)
  } catch (e) {
    return Response.json({ error: `token: ${e instanceof Error ? e.message : String(e)}` })
  }

  const out: Record<string, unknown> = {
    invoice: {
      id: inv.id,
      numero: inv.invoice_number,
      data: inv.invoice_date,
      nif: inv.supplier_nif,
      fornecedor: inv.supplier_name,
      subtotal: inv.subtotal,
      vat_rate: inv.vat_rate,
      total: inv.total,
    },
    appBase: t.appBase,
    apiBase: t.apiBase,
  }

  // 1) Dedup (mesmo filtro do fc.ts)
  if (inv.invoice_number) {
    const filter = encodeURIComponent(
      `"((parent_document_area != document_area) OR (parent_document_area IS NULL))` +
        ` AND document_type in ('FC','DSP','NCF','NDF','NLDF','NLCF','SIF','FCA')` +
        ` AND (external_reference::TEXT ILIKE '%${inv.invoice_number}%'` +
        ` OR searchable_document_no::TEXT ILIKE '%${inv.invoice_number}%')` +
        ` AND (document_type IN ('FC')` +
        ` OR searchable_document_types::text ILIKE '%FC%')"`,
    )
    const url = `${t.appBase}/api/commercial_purchases_documents_list_for_invoices?filter=${filter}`
    const r = await fetch(url, { headers: { Authorization: `Bearer ${t.accessToken}`, Accept: "application/json" } })
    const body = await r.text()
    out.dedup = { http_status: r.status, preview: body.slice(0, 500) }
  }

  // 2) Fornecedor
  if (inv.supplier_nif) {
    const f = encodeURIComponent(`" s.tax_registration_number::TEXT ILIKE '%${inv.supplier_nif}%' "`)
    const url = `${t.appBase}/api/suppliers_moac?filter=${f}`
    const r = await fetch(url, { headers: { Authorization: `Bearer ${t.accessToken}`, Accept: "application/json" } })
    const body = await r.text()
    out.fornecedor_lookup = { http_status: r.status, preview: body.slice(0, 600) }
  }

  // 3) Payload que seria enviado (ja' com tax_code derivado do IVA)
  const rate = inv.vat_rate !== null ? Number(inv.vat_rate) : null
  const taxCode = rate === null ? "NOR" : rate === 0 ? "ISE" : rate <= 6 ? "RED" : rate <= 13 ? "INT" : "NOR"
  const invoiceDate = (inv.invoice_date as string) ?? new Date().toISOString().slice(0, 10)
  const description = (inv.description as string) ?? (inv.supplier_name as string) ?? "Fatura importada ISOFlow"
  const payload: Record<string, unknown> = {
    document_type: "FC",
    date: invoiceDate,
    due_date: invoiceDate,
    external_reference: inv.invoice_number ?? "",
    notes: description,
    vat_included_prices: false,
    retention_total: 0,
    lines: [
      {
        item_type: "Purchases::ExpenseCategory",
        item_code: "6221",
        description,
        quantity: 1,
        unit_price: inv.subtotal !== null ? Number(inv.subtotal) : 0,
        tax_code: taxCode,
      },
    ],
  }
  out.tax_code_derivado = taxCode
  out.payload_actual = payload

  // 4) Só com ?post=1: reproduzir a sequencia REAL (fornecedor -> FC)
  if (doPost) {
    // 4a) Criar fornecedor se nao existir (este e' o passo suspeito)
    let supplierId: number | null = null
    const lookup = out.fornecedor_lookup as { preview?: string } | undefined
    const jaExiste = lookup?.preview && !lookup.preview.includes('"data":[]')
    if (!jaExiste && inv.supplier_nif && inv.supplier_name) {
      // Formato JSON:API conforme a doc oficial (/api/suppliers, vnd.api+json)
      const supPayload = {
        data: {
          type: "suppliers",
          attributes: {
            tax_registration_number: Number(inv.supplier_nif),
            business_name: inv.supplier_name,
          },
        },
      }
      const tentativas = []
      for (const base of [t.apiBase, t.appBase]) {
        const r = await fetch(`${base}/api/suppliers`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${t.accessToken}`,
            "Content-Type": "application/vnd.api+json",
            Accept: "application/json",
          },
          body: JSON.stringify(supPayload),
        })
        const body = await r.text()
        tentativas.push({ url: `${base}/api/suppliers`, http_status: r.status, body: body.slice(0, 900) })
        if (r.ok) {
          try {
            const j = JSON.parse(body)
            const d = j.data ?? j
            supplierId = d?.id ? Number(d.id) : d?.attributes?.id ? Number(d.attributes.id) : null
          } catch {
            supplierId = null
          }
          break
        }
        if (r.status !== 404) break
      }
      out.post_fornecedor = { payload: supPayload, tentativas, supplier_id: supplierId }
      if (supplierId === null) {
        out.post_fc = "nao executado (criacao de fornecedor falhou - ver post_fornecedor)"
        return Response.json(out)
      }
    }

    if (supplierId !== null) payload.supplier_id = supplierId

    // 4b) Criar FC
    const r2 = await fetch(`${t.apiBase}/api/v1/commercial_purchases_documents`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    })
    const body2 = await r2.text()
    out.post_fc = { http_status: r2.status, supplier_id_usado: supplierId, body: body2.slice(0, 1500) }
  } else {
    out.post_fc = "nao executado (usa ?post=1 para reproduzir a sequencia real e capturar o erro)"
  }

  return Response.json(out)
}
