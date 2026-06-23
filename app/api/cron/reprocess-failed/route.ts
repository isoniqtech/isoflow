import { createAdminClient } from "@/lib/supabase/admin"
import { findFailedExtractions, reprocessInvoice } from "@/lib/claude/reprocess-invoice"

export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get("authorization")
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  // Buscar todos os tenants activos
  const { data: tenants } = await admin
    .from("tenants")
    .select("id")
    .in("status", ["active", "trial"])

  if (!tenants?.length) {
    return Response.json({ processed: 0, ok: 0, errors: 0 })
  }

  let totalProcessed = 0
  let totalOk = 0
  let totalErrors = 0

  for (const tenant of tenants) {
    const failedIds = await findFailedExtractions(tenant.id, admin, 10)
    if (!failedIds.length) continue

    for (const invoiceId of failedIds) {
      const result = await reprocessInvoice(invoiceId, tenant.id, admin, admin)
      totalProcessed++
      if (result.ok) {
        totalOk++
        console.log(`reprocess ok: ${invoiceId} — ${result.supplierName} (${result.confidence})`)
      } else {
        totalErrors++
        console.warn(`reprocess failed: ${invoiceId} — ${result.error}`)
      }
    }
  }

  return Response.json({ processed: totalProcessed, ok: totalOk, errors: totalErrors })
}
