/**
 * CRUD da config Anthropic por tenant (type='ai', provider='anthropic').
 * Chaves nunca sao devolvidas em claro - apenas flag has_key e modelo.
 * Acesso restrito a owner/admin (integracao.manage).
 */
import { z } from "zod"
import Anthropic from "@anthropic-ai/sdk"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createClient } from "@/lib/supabase/server"
import { encrypt, decryptOptional } from "@/lib/utils/encryption"
import { ANTHROPIC_SUPPORTED_MODELS } from "@/lib/claude/extract-invoice"

export async function GET() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "view_all")) {
    return jsonError("Forbidden", 403)
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from("tenant_integrations")
    .select("is_active, config, api_key_encrypted, last_sync_at, sync_error")
    .eq("tenant_id", ctx.tenantId)
    .eq("type", "ai")
    .eq("provider", "anthropic")
    .maybeSingle()

  if (error) return jsonError("Database error", 500, error.message)
  if (!data) return Response.json({ configured: false, model: null })

  const config = (data.config ?? {}) as { model?: string }

  return Response.json({
    configured: true,
    has_key: !!data.api_key_encrypted,
    model: config.model ?? null,
    is_active: data.is_active,
    last_sync_at: data.last_sync_at,
    sync_error: data.sync_error,
  })
}

const saveSchema = z.object({
  api_key: z.string().min(10),
  model: z.enum(
    ANTHROPIC_SUPPORTED_MODELS.map((m) => m.id) as [string, ...string[]],
  ),
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

  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError("Validation error", 400, parsed.error.flatten())
  }

  const { api_key, model } = parsed.data

  // Validar a chave com uma chamada de teste minima (models.list)
  try {
    const client = new Anthropic({ apiKey: api_key })
    // Chamada barata que so verifica autenticacao
    await client.models.list({ limit: 1 })
  } catch (e) {
    const status = (e as { status?: number })?.status
    if (status === 401 || status === 403) {
      return jsonError("Chave API Anthropic invalida", 400)
    }
    if (status === 429) {
      return jsonError("Rate limit Anthropic atingido - tenta de novo em alguns segundos", 429)
    }
    return jsonError(
      `Erro ao validar chave Anthropic: ${e instanceof Error ? e.message : String(e)}`,
      400,
    )
  }

  const supabase = createClient()
  const { error } = await supabase.from("tenant_integrations").upsert(
    {
      tenant_id: ctx.tenantId,
      type: "ai",
      provider: "anthropic",
      api_key_encrypted: encrypt(api_key),
      config: { model },
      is_active: true,
      sync_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,type,provider" },
  )

  if (error) return jsonError("Database error", 500, error.message)

  return Response.json({ ok: true, model })
}

export async function DELETE() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "edit")) {
    return jsonError("Forbidden", 403)
  }

  const supabase = createClient()
  const { error } = await supabase
    .from("tenant_integrations")
    .delete()
    .eq("tenant_id", ctx.tenantId)
    .eq("type", "ai")
    .eq("provider", "anthropic")

  if (error) return jsonError("Database error", 500, error.message)

  return Response.json({ ok: true })
}
