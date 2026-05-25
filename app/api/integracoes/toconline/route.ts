import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { decryptOptional } from "@/lib/utils/encryption"
import { fetchSalesDocuments } from "@/lib/integrations/toconline"

export async function GET() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "edit")) {
    return jsonError("Forbidden", 403)
  }

  const supabase = createClient()
  const { data: integration, error } = await supabase
    .from("tenant_integrations")
    .select("api_key_encrypted, config, is_active, last_sync_at, sync_error")
    .eq("tenant_id", ctx.tenantId)
    .eq("type", "erp")
    .eq("provider", "toconline")
    .maybeSingle()

  if (error) return jsonError("Database error", 500, error.message)
  if (!integration) return Response.json({ connected: false })

  let accessToken: string | null = null
  try {
    accessToken = decryptOptional(integration.api_key_encrypted)
  } catch {}

  if (!accessToken || !integration.is_active) {
    return Response.json({ connected: false })
  }

  const config = (integration.config ?? {}) as Record<string, string>
  const baseUrl = config.base_url ?? "https://app.toconline.pt"

  try {
    const today = new Date()
    const thisMonth = today.toISOString().slice(0, 7)
    const docs = await fetchSalesDocuments(accessToken, baseUrl, {
      dateFrom: `${thisMonth}-01`,
      dateTo: today.toISOString().slice(0, 10),
    })
    return Response.json({ connected: true, doc_count: docs.length })
  } catch (e) {
    return Response.json({
      connected: false,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

const actionSchema = z.object({
  action: z.enum(["sync"]),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
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

  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError("Validation error", 400, parsed.error.flatten())
  }

  const now = new Date()
  const month = parsed.data.month ?? now.getMonth() + 1
  const year = parsed.data.year ?? now.getFullYear()

  const syncRes = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/faturas/sync-toconline`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ month, year, type: "both" }),
    },
  )

  const syncBody = await syncRes.json()
  if (!syncRes.ok) {
    return jsonError("Sync failed", syncRes.status, syncBody.error)
  }

  return Response.json(syncBody)
}
