import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "banco", "view_all")) {
    return jsonError("Forbidden", 403)
  }

  const url = new URL(req.url)
  const limit = Math.min(200, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50)
  const matched = url.searchParams.get("matched") // "true" | "false" | null

  const supabase = createClient()
  let query = supabase
    .from("bank_transactions")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("date", { ascending: false })
    .limit(limit)

  if (matched === "true") query = query.not("invoice_id", "is", null)
  if (matched === "false") query = query.is("invoice_id", null)

  const { data, error } = await query
  if (error) return jsonError("Database error", 500, error.message)
  return Response.json({ data })
}
