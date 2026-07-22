import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { PRE_ERP_STATUSES } from "@/lib/utils/invoice-status"

const bodySchema = z.object({
  fc_number: z.string().min(1),
  tenant_id: z.string().uuid(),
})

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const secret = req.headers.get("x-isoflow-secret")
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { error } = await admin.from("invoices")
    .update({
      toconline_fc_id: parsed.data.fc_number,
      erp_synced: true,
      erp_synced_at: now,
      updated_at: now,
    })
    .eq("id", params.id)
    .eq("tenant_id", parsed.data.tenant_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Promover o estado apenas se a fatura ainda estiver numa fase anterior ao
  // ERP (o filtro .in garante que nao pisamos rejected/paid/reconciled/...)
  await admin
    .from("invoices")
    .update({ status: "enviada_erp", updated_at: now })
    .eq("id", params.id)
    .eq("tenant_id", parsed.data.tenant_id)
    .in("status", PRE_ERP_STATUSES as unknown as string[])

  return NextResponse.json({ ok: true })
}
