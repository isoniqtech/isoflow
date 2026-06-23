import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"

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

  return NextResponse.json({ ok: true })
}
