import { z } from "zod"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { getValidToken } from "@/lib/toconline/token"
import {
  fetchPurchaseDocuments,
  fetchSalesDocuments,
  mapTOCDocumentToInvoice,
  type TOCOnlineDocument,
} from "@/lib/integrations/toconline"
import { createClient } from "@/lib/supabase/server"

const bodySchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  type: z.enum(["purchases", "sales", "both"]),
})

export async function POST(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "edit")) {
    return jsonError("Forbidden", 403)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError("Invalid JSON", 400)
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return jsonError("Validation error", 400, parsed.error.flatten())
  }

  const { month, year, type } = parsed.data
  const tenantId = ctx.tenantId

  let tokenConfig: Awaited<ReturnType<typeof getValidToken>>
  try {
    tokenConfig = await getValidToken(tenantId)
  } catch (e) {
    return jsonError("TOConline nao disponivel", 503, String(e))
  }

  const { accessToken, apiBase } = tokenConfig

  // Buscar todos os documentos sem filtro de data (API nao suporta date_from/to)
  // Filtrar por mes/ano no codigo
  const monthKey = `${year}-${String(month).padStart(2, "0")}`

  const supabase = createClient()
  const errors: string[] = []
  let created = 0
  let updated = 0

  async function processDocs(docs: TOCOnlineDocument[], invoiceType: "incoming" | "outgoing") {
    // Filtrar apenas documentos do mes/ano pedido
    const filtered = docs.filter((d) => d.date?.startsWith(monthKey))

    for (const doc of filtered) {
      try {
        const erpDocId = doc.id.toString()

        const { data: existing } = await supabase
          .from("invoices")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("erp_document_id", erpDocId)
          .maybeSingle()

        if (existing) {
          await supabase
            .from("invoices")
            .update({
              erp_synced: true,
              erp_synced_at: new Date().toISOString(),
              at_communicated: doc.communication_status === "sent",
              at_communicated_at:
                doc.communication_status === "sent" ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id)
            .eq("tenant_id", tenantId)
          updated++
          continue
        }

        if (
          doc.document_number &&
          (doc.supplier_tax_registration_number || doc.client_tax_registration_number)
        ) {
          const nif =
            invoiceType === "incoming"
              ? doc.supplier_tax_registration_number
              : doc.client_tax_registration_number

          const { data: byNifAndNum } = await supabase
            .from("invoices")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("invoice_number", doc.document_number)
            .eq("supplier_nif", nif ?? "")
            .maybeSingle()

          if (byNifAndNum) {
            await supabase
              .from("invoices")
              .update({
                erp_document_id: erpDocId,
                erp_synced: true,
                erp_synced_at: new Date().toISOString(),
                at_communicated: doc.communication_status === "sent",
                at_communicated_at:
                  doc.communication_status === "sent" ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", byNifAndNum.id)
              .eq("tenant_id", tenantId)
            updated++
            continue
          }
        }

        const invoiceData = mapTOCDocumentToInvoice(doc, tenantId, invoiceType)
        const { error: insertErr } = await supabase.from("invoices").insert(invoiceData)

        if (insertErr) {
          errors.push(`Doc ${doc.id}: ${insertErr.message}`)
        } else {
          created++
        }
      } catch (e) {
        errors.push(`Doc ${doc.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  try {
    if (type === "purchases" || type === "both") {
      const docs = await fetchPurchaseDocuments(accessToken, apiBase)
      await processDocs(docs, "incoming")
    }
    if (type === "sales" || type === "both") {
      const docs = await fetchSalesDocuments(accessToken, apiBase)
      await processDocs(docs, "outgoing")
    }
  } catch (e) {
    return jsonError("TOConline API error", 502, String(e))
  }

  return Response.json({ created, updated, errors })
}
