/**
 * Define o modo de integracao ERP do tenant (n8n | toconline_direct).
 * Acesso restrito a owner (integracao.manage).
 */
import { z } from "zod"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createClient } from "@/lib/supabase/server"
import type { IntegrationMode } from "@/types"

const bodySchema = z.object({
  mode: z.enum(["n8n", "toconline_direct"]),
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

  const supabase = createClient()
  const { error } = await supabase
    .from("tenants")
    .update({
      integration_mode: parsed.data.mode as IntegrationMode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.tenantId)

  if (error) return jsonError("Database error", 500, error.message)

  return Response.json({ ok: true, mode: parsed.data.mode })
}
