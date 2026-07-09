import { timingSafeEqual } from "crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { z } from "zod"

const bodySchema = z.object({
  tenant_id: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  total: z.number().min(0),
})

function verifySecret(header: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || !header) return false
  try {
    return timingSafeEqual(Buffer.from(secret), Buffer.from(header))
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  if (!verifySecret(req.headers.get("x-isoflow-secret"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = bodySchema.parse(await req.json())
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { tenant_id, month, year, total } = parsed
  const supabase = createServiceClient()

  await supabase
    .from("monthly_snapshots")
    .upsert(
      { tenant_id, month, year, expenses: total, saved_at: new Date().toISOString() },
      { onConflict: "tenant_id,month,year" },
    )

  return Response.json({ ok: true, tenant_id, month, year, total })
}
