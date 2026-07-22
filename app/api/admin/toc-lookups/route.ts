/**
 * ROTA TEMPORÁRIA DE DIAGNÓSTICO - remover após configurar os códigos.
 * Só super-admin. Lista as categorias de gasto e os códigos de imposto reais
 * do TOConline do tenant (endpoints descobertos: /api/expense_categories e
 * /api/taxes, ambos em appBase). Read-only.
 *
 * Query params:
 *   ?tenant=<uuid>  outro tenant (default Revive)
 *   ?q=<texto>      filtrar categorias por nome ou accounting_number
 *   ?regiao=PT      filtrar impostos por regiao (default PT)
 */
import { getApiContext, jsonError } from "@/lib/api/auth"
import { getValidToken } from "@/lib/toconline/token"

export const runtime = "nodejs"
export const maxDuration = 60

const REVIVE_TENANT_ID = "475826a5-d08c-4e99-8b95-39b48a245949"

type JsonApiItem = { id?: string; attributes?: Record<string, unknown> }

async function getJsonApi(url: string, token: string): Promise<JsonApiItem[]> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  })
  if (!res.ok) return []
  const body = await res.json().catch(() => null)
  let container: unknown = body
  const d = (body as Record<string, unknown>)?.data
  if (typeof d === "string") {
    try {
      container = JSON.parse(d)
    } catch {
      return []
    }
  } else if (d !== undefined) {
    container = d
  }
  if (Array.isArray(container)) return container as JsonApiItem[]
  const inner = (container as Record<string, unknown>)?.data
  return Array.isArray(inner) ? (inner as JsonApiItem[]) : []
}

export async function GET(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (process.env.SUPER_ADMIN_USER_ID !== ctx.userId) return jsonError("Forbidden", 403)

  const { searchParams } = new URL(req.url)
  const tenantId = searchParams.get("tenant") || REVIVE_TENANT_ID
  const q = (searchParams.get("q") ?? "").toLowerCase().trim()
  const regiao = (searchParams.get("regiao") ?? "PT").toUpperCase()

  let t: Awaited<ReturnType<typeof getValidToken>>
  try {
    t = await getValidToken(tenantId)
  } catch (e) {
    return Response.json({ error: `token: ${e instanceof Error ? e.message : String(e)}` })
  }

  // Categorias de gasto
  const catsRaw = await getJsonApi(`${t.appBase}/api/expense_categories`, t.accessToken)
  const cats = catsRaw.map((c) => {
    const a = c.attributes ?? {}
    return {
      id: c.id,
      nome: a.name as string | undefined,
      accounting_number: a.accounting_number as string | undefined,
      tax_code: a.tax_code as string | undefined,
      dedutibilidade: a.tax_deductibility as number | undefined,
      is_main: a.is_main as boolean | undefined,
    }
  })
  const catsFiltradas = q
    ? cats.filter(
        (c) =>
          (c.nome ?? "").toLowerCase().includes(q) ||
          (c.accounting_number ?? "").toLowerCase().includes(q),
      )
    : cats

  // Impostos
  const taxesRaw = await getJsonApi(`${t.appBase}/api/taxes`, t.accessToken)
  const taxes = taxesRaw
    .map((x) => {
      const a = x.attributes ?? {}
      return {
        regiao: a.tax_country_region as string | undefined,
        tax_code: a.tax_code as string | undefined,
        descricao: a.description as string | undefined,
        percentagem: a.tax_percentage as string | undefined,
      }
    })
    .filter((x) => (regiao === "TODAS" ? true : (x.regiao ?? "").toUpperCase() === regiao))

  return Response.json({
    tenantId,
    appBase: t.appBase,
    total_categorias: cats.length,
    existe_6221: cats.some((c) => c.accounting_number === "6221"),
    categoria_6221: cats.find((c) => c.accounting_number === "6221") ?? null,
    impostos: taxes,
    categorias: catsFiltradas,
  })
}
