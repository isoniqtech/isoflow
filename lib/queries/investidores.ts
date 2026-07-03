import { createClient } from "@/lib/supabase/server"
import type { Investidor, InvestidorEstado, TipoNegocio } from "@/types"

export type InvestidorListItem = {
  id: string
  nome: string
  email: string
  estado: InvestidorEstado
  capital_disponivel: number
  tipo_negocio: TipoNegocio[]
  user_id: string | null
  projetos_count: number
  capital_alocado: number
}

export type InvestidorDetail = Investidor & {
  projetos: Array<{
    id: string
    nome: string
    code: string | null
    status: string
    budget: number | null
    color: string
    percentagem: number
    valor_estimado: number | null
    total_gasto: number
  }>
}

export type InvestidorStats = {
  total: number
  prontos: number
  em_investimento: number
  nao_disponiveis: number
  capital_disponivel_total: number
  capital_alocado_total: number
}

export async function listInvestidores(tenantId: string): Promise<InvestidorListItem[]> {
  const supabase = createClient()

  const { data: rows } = await supabase
    .from("investidores")
    .select("id, nome, email, estado, capital_disponivel, tipo_negocio, user_id")
    .eq("tenant_id", tenantId)
    .order("nome", { ascending: true })

  if (!rows?.length) return []

  const ids = rows.map((r) => r.id)

  const { data: links } = await supabase
    .from("projeto_investidores")
    .select("investidor_id, percentagem, projeto_id")
    .in("investidor_id", ids)

  const { data: projsRaw } = await supabase
    .from("projects")
    .select("id, budget")
    .eq("tenant_id", tenantId)
    .eq("status", "active")

  const budgetMap = new Map((projsRaw ?? []).map((p) => [p.id, Number(p.budget ?? 0)]))

  const byInvestidor = new Map<string, { count: number; alocado: number }>()
  for (const link of links ?? []) {
    const cur = byInvestidor.get(link.investidor_id) ?? { count: 0, alocado: 0 }
    const budget = budgetMap.get(link.projeto_id) ?? 0
    cur.count += 1
    cur.alocado += (budget * Number(link.percentagem)) / 100
    byInvestidor.set(link.investidor_id, cur)
  }

  return rows.map((r) => {
    const agg = byInvestidor.get(r.id) ?? { count: 0, alocado: 0 }
    return {
      id: r.id,
      nome: r.nome,
      email: r.email,
      estado: r.estado as InvestidorEstado,
      capital_disponivel: Number(r.capital_disponivel ?? 0),
      tipo_negocio: (r.tipo_negocio ?? []) as TipoNegocio[],
      user_id: r.user_id,
      projetos_count: agg.count,
      capital_alocado: agg.alocado,
    }
  })
}

export async function getInvestidorDetail(
  investidorId: string,
  tenantId: string,
): Promise<InvestidorDetail | null> {
  const supabase = createClient()

  const { data: inv } = await supabase
    .from("investidores")
    .select("*")
    .eq("id", investidorId)
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (!inv) return null

  const { data: links } = await supabase
    .from("projeto_investidores")
    .select("percentagem, projeto_id")
    .eq("investidor_id", investidorId)

  const projetoIds = (links ?? []).map((l) => l.projeto_id)
  const percentMap = new Map((links ?? []).map((l) => [l.projeto_id, Number(l.percentagem)]))

  const projetos: InvestidorDetail["projetos"] = []

  if (projetoIds.length) {
    const { data: projs } = await supabase
      .from("projects")
      .select("id, name, code, status, budget, color")
      .in("id", projetoIds)

    const { data: invoices } = await supabase
      .from("invoices")
      .select("project_id, subtotal, total")
      .in("project_id", projetoIds)
      .eq("tenant_id", tenantId)
      .neq("status", "rejected")

    const gastoMap = new Map<string, number>()
    for (const inv of invoices ?? []) {
      if (!inv.project_id) continue
      gastoMap.set(
        inv.project_id,
        (gastoMap.get(inv.project_id) ?? 0) + Number(inv.total ?? 0),
      )
    }

    for (const p of projs ?? []) {
      const pct = percentMap.get(p.id) ?? 0
      const budget = p.budget !== null ? Number(p.budget) : null
      projetos.push({
        id: p.id,
        nome: p.name,
        code: p.code,
        status: p.status,
        budget,
        color: p.color ?? "#2563EB",
        percentagem: pct,
        valor_estimado: budget !== null ? (budget * pct) / 100 : null,
        total_gasto: gastoMap.get(p.id) ?? 0,
      })
    }
  }

  return {
    ...(inv as Investidor),
    projetos,
  }
}

export async function getInvestidorStats(tenantId: string): Promise<InvestidorStats> {
  const supabase = createClient()

  const { data: rows } = await supabase
    .from("investidores")
    .select("id, estado, capital_disponivel")
    .eq("tenant_id", tenantId)

  const { data: links } = await supabase
    .from("projeto_investidores")
    .select("percentagem, investidor_id, projeto_id")

  const { data: projs } = await supabase
    .from("projects")
    .select("id, budget")
    .eq("tenant_id", tenantId)
    .eq("status", "active")

  const budgetMap = new Map((projs ?? []).map((p) => [p.id, Number(p.budget ?? 0)]))

  let capitalAlocado = 0
  for (const link of links ?? []) {
    capitalAlocado += (budgetMap.get(link.projeto_id) ?? 0) * Number(link.percentagem) / 100
  }

  return {
    total: rows?.length ?? 0,
    prontos: rows?.filter((r) => r.estado === "pronto_para_investir").length ?? 0,
    em_investimento: rows?.filter((r) => r.estado === "em_investimento").length ?? 0,
    nao_disponiveis: rows?.filter((r) => r.estado === "nao_disponivel").length ?? 0,
    capital_disponivel_total: rows?.reduce((s, r) => s + Number(r.capital_disponivel ?? 0), 0) ?? 0,
    capital_alocado_total: capitalAlocado,
  }
}

export async function getInvestidorByUserId(
  userId: string,
): Promise<(Investidor & { projetos: InvestidorDetail["projetos"] }) | null> {
  const supabase = createClient()

  const { data: inv } = await supabase
    .from("investidores")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (!inv) return null

  return getInvestidorDetail(inv.id, inv.tenant_id)
}

// IDs dos projetos onde o user (com role investidor) esta associado
// Usado para filtrar projetos e faturas visiveis ao investidor
export async function getInvestidorProjectIds(userId: string): Promise<string[]> {
  const supabase = createClient()

  const { data: inv } = await supabase
    .from("investidores")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  if (!inv) return []

  type LinkRow = { projeto_id: string }
  const { data: links } = await (supabase as unknown as {
    from: (t: string) => { select: (c: string) => { eq: (k: string, v: unknown) => Promise<{ data: LinkRow[] | null }> } }
  })
    .from("projeto_investidores")
    .select("projeto_id")
    .eq("investidor_id", inv.id)

  return (links ?? []).map((l) => l.projeto_id)
}
