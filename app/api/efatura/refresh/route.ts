import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { runEfaturaSync } from "@/lib/efatura/sync"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "faturas", "edit")) return jsonError("Forbidden", 403)

  // Quantos meses buscar. Default 2 = mes atual + anterior (o "Atualizar").
  // O "Importar historico" envia um valor maior (1..24). Sem body -> default.
  let months = 2
  try {
    const body = (await req.json()) as { months?: number } | null
    if (body?.months && Number.isFinite(body.months)) {
      months = Math.min(Math.max(Math.trunc(body.months), 1), 24)
    }
  } catch {
    // sem body -> mantem default 2
  }

  try {
    const result = await runEfaturaSync(ctx.tenantId, months)
    return Response.json(result)
  } catch (e) {
    return jsonError(
      "Erro ao sincronizar e-Fatura",
      500,
      e instanceof Error ? e.message : String(e),
    )
  }
}
