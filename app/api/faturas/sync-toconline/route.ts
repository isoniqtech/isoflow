import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { decryptOptional } from "@/lib/utils/encryption"
import {
  fetchPurchaseDocuments,
  fetchSalesDocuments,
  mapTOCDocumentToInvoice,
  type TOCOnlineDocument,
} from "@/lib/integrations/toconline"

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
  const supabase = createClient()

  const { data: integration, error: intErr } = await supabase
    .from("tenant_integrations")
    .select("api_key_encrypted, config, is_active")
    .eq("tenant_id", tenantId)
    .eq("type", "erp")
    .eq("provider", "toconline")
    .maybeSingle()

  if (intErr) return jsonError("Database error", 500, intErr.message)
  if (!integration) return jsonError("Toconline integration not configured", 404)
  if (!integration.is_active) return jsonError("Toconline integration is disabled", 400)

  let accessToken: string
  try {
    accessToken = decryptOptional(integration.api_key_encrypted) ?? ""
    if (!accessToken) throw new Error("Missing access token")
  } catch (e) {
    return jsonError("Failed to decrypt credentials", 500, String(e))
  }

  const config = (integration.config ?? {}) as Record<string, string>
  const baseUrl = config.base_url ?? "https://app.toconline.pt"

  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0)
  const dateFrom = startDate.toISOString().slice(0, 10)
  const dateTo = endDate.toISOString().slice(0, 10)
  const filters = { dateFrom, dateTo }

  const errors: string[] = []
  let created = 0
  let updated = 0

  async function processDocs(
    docs: TOCOnlineDocument[],
    invoiceType: "incoming" | "outgoing",
  ) {
    for (const doc of docs) {
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
                doc.communication_status === "sent"
                  ? new Date().toISOString()
                  : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id)
            .eq("tenant_id", tenantId)
          updated++
          continue
        }

        if (doc.document_number && (doc.supplier_tax_registration_number || doc.client_tax_registration_number)) {
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
                  doc.communication_status === "sent"
                    ? new Date().toISOString()
                    : null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", byNifAndNum.id)
              .eq("tenant_id", tenantId)
            updated++
            continue
          }
        }

        const invoiceData = mapTOCDocumentToInvoice(doc, tenantId, invoiceType)
        const { error: insertErr } = await supabase
          .from("invoices")
          .insert(invoiceData)

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
      const docs = await fetchPurchaseDocuments(accessToken, baseUrl, filters)
      await processDocs(docs, "incoming")
    }
    if (type === "sales" || type === "both") {
      const docs = await fetchSalesDocuments(accessToken, baseUrl, filters)
      await processDocs(docs, "outgoing")
    }
  } catch (e) {
    return jsonError("TOConline API error", 502, String(e))
  }

  return Response.json({ created, updated, errors })
}
