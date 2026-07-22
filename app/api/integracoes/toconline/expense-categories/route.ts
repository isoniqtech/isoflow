/**
 * Catalogo de categorias de gasto do TOConline (modo direto), para o seletor
 * no detalhe da fatura. Le da cache local e sincroniza em silencio quando
 * esta' em falta ou desactualizada.
 */
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { createClient } from "@/lib/supabase/server"
import { getExpenseCategories } from "@/lib/toconline/expense-categories"

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET() {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "faturas", "view_own")) return jsonError("Forbidden", 403)

  const supabase = createClient()
  const categorias = await getExpenseCategories(ctx.tenantId, supabase)

  return Response.json({ categorias })
}
