import { NextResponse } from "next/server"
import { z } from "zod"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { forwardInvoiceToN8N } from "@/lib/webhooks/n8n"
import { log } from "@/lib/utils/audit"

const bodySchema = z.object({
  invoice_ids: z.array(z.string().uuid()).min(1).max(50),
})

export async function POST(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "faturas", "edit")) return jsonError("Forbidden", 403)

  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return jsonError("Invalid body", 400)

  const admin = createAdminClient()
  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const id of parsed.data.invoice_ids) {
    const result = await forwardInvoiceToN8N(admin, id, ctx.tenantId)
    if (result.skipped) { skipped++; continue }
    if (!result.ok) { errors.push(`${id}: ${result.error ?? `HTTP ${result.status}`}`); continue }
    sent++
    await log(admin, {
      action: "invoice.erp_send",
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      resourceType: "invoice",
      resourceId: id,
      metadata: { ok: true },
    })
  }

  return NextResponse.json({ sent, skipped, errors })
}
