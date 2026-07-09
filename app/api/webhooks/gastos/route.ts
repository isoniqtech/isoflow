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
  const now = new Date().toISOString()

  // Tenta UPDATE primeiro (row já existe pela receita)
  const { data: updated, error: updateError } = await supabase
    .from("monthly_snapshots")
    .update({ expenses: total, saved_at: now })
    .eq("tenant_id", tenant_id)
    .eq("month", month)
    .eq("year", year)
    .select("id")

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 })
  }

  // Se não havia row, insere
  if (!updated || updated.length === 0) {
    const { error: insertError } = await supabase
      .from("monthly_snapshots")
      .insert({ tenant_id, month, year, expenses: total, saved_at: now })

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 })
    }
  }

  return Response.json({ ok: true, tenant_id, month, year, total })
}
