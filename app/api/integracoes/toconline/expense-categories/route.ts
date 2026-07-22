/**
 * Categorias de gasto do TOConline (modo direto).
 * GET  - lista as categorias reais do tenant + a que esta' configurada
 * POST - guarda a categoria default do tenant (config.default_expense_category)
 *
 * A lista vem de GET {appBase}/api/expense_categories. Cada categoria tem um
 * accounting_number (e' o item_code usado nas linhas da FC) e o seu tax_code.
 */
import { z } from "zod"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createClient } from "@/lib/supabase/server"
import { getValidToken } from "@/lib/toconline/token"
import { DEFAULT_EXPENSE_CATEGORY } from "@/lib/toconline/fc"

export const runtime = "nodejs"
export const maxDuration = 60

type JsonApiItem = { id?: string; attributes?: Record<string, unknown> }

export async function GET() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "view_all")) return jsonError("Forbidden", 403)

  const supabase = createClient()
  const { data: row } = await supabase
    .from("tenant_integrations")
    .select("config")
    .eq("tenant_id", ctx.tenantId)
    .eq("type", "erp")
    .eq("provider", "toconline")
    .maybeSingle()

  const configurada =
    (row?.config as { default_expense_category?: string } | null)?.default_expense_category ?? null

  let categorias: { codigo: string; nome: string; tax_code: string | null }[] = []
  let erro: string | null = null
  try {
    const t = await getValidToken(ctx.tenantId)
    const res = await fetch(`${t.appBase.replace(/\/$/, "")}/api/expense_categories`, {
      headers: { Authorization: `Bearer ${t.accessToken}`, Accept: "application/json" },
    })
    if (!res.ok) throw new Error(`TOConline ${res.status}`)
    const body = await res.json()
    const items: JsonApiItem[] = Array.isArray(body?.data) ? body.data : []
    categorias = items
      .map((c) => {
        const a = c.attributes ?? {}
        return {
          codigo: String(a.accounting_number ?? ""),
          nome: String(a.name ?? ""),
          tax_code: (a.tax_code as string | null) ?? null,
        }
      })
      .filter((c) => c.codigo && c.nome)
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
  } catch (e) {
    erro = e instanceof Error ? e.message : String(e)
  }

  return Response.json({
    configurada,
    default_fallback: DEFAULT_EXPENSE_CATEGORY,
    categorias,
    erro,
  })
}

const saveSchema = z.object({ codigo: z.string().trim().min(1).max(32) })

export async function POST(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "edit")) return jsonError("Forbidden", 403)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError("Invalid JSON", 400)
  }
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) return jsonError("Validation error", 400, parsed.error.flatten())

  const supabase = createClient()
  const { data: row } = await supabase
    .from("tenant_integrations")
    .select("config")
    .eq("tenant_id", ctx.tenantId)
    .eq("type", "erp")
    .eq("provider", "toconline")
    .maybeSingle()

  if (!row) return jsonError("Integracao TOConline nao encontrada", 404)

  // Merge no config existente para nao perder subdomain/redirect_uri/etc.
  const config = { ...((row.config ?? {}) as Record<string, unknown>) }
  config.default_expense_category = parsed.data.codigo

  const { error } = await supabase
    .from("tenant_integrations")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("tenant_id", ctx.tenantId)
    .eq("type", "erp")
    .eq("provider", "toconline")

  if (error) return jsonError("Database error", 500, error.message)

  return Response.json({ ok: true, configurada: parsed.data.codigo })
}
