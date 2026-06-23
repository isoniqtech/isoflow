import { NextResponse } from "next/server"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)

  const { searchParams } = new URL(req.url)
  const ids = searchParams.get("ids")?.split(",").filter(Boolean) ?? []
  if (!ids.length) return jsonError("ids obrigatorio", 400)

  const admin = createAdminClient()
  const { data } = await admin
    .from("invoices")
    .select("id, toconline_fc_id")
    .eq("tenant_id", ctx.tenantId)
    .in("id", ids)

  const allDone = (data ?? []).length === ids.length && (data ?? []).every((r) => !!r.toconline_fc_id)

  return NextResponse.json({ allDone, results: (data ?? []).map((r) => ({ id: r.id, fc: r.toconline_fc_id })) })
}
