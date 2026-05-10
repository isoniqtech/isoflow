import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

type Client = SupabaseClient<Database>

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
}

/**
 * Tenta identificar o projeto referido num texto livre (ex: mensagem WhatsApp,
 * assunto de email). Devolve o id do projeto se houver match com o nome ou
 * algum dos aliases. Match é case/diacritic-insensitive.
 */
export async function matchProjectFromText(
  text: string,
  tenantId: string,
  supabase: Client,
): Promise<string | null> {
  if (!text) return null

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, name_aliases")
    .eq("tenant_id", tenantId)
    .eq("status", "active")

  if (!projects?.length) return null

  const haystack = ` ${normalize(text)} `

  for (const project of projects) {
    const candidates = [project.name, ...(project.name_aliases ?? [])]
      .filter((c): c is string => Boolean(c))
      .map(normalize)
      .filter((c) => c.length >= 2)

    for (const candidate of candidates) {
      const needle = ` ${candidate} `
      if (haystack.includes(needle)) return project.id
    }
  }

  return null
}

/**
 * Calcula gasto atual e percentagem de orçamento usado para um projeto.
 * Devolve null se o projeto não tiver orçamento definido.
 */
export async function computeBudgetUsage(
  projectId: string,
  tenantId: string,
  supabase: Client,
): Promise<{
  spent: number
  budget: number
  threshold: number
  pct: number
  overBudget: boolean
  overThreshold: boolean
} | null> {
  const { data: project } = await supabase
    .from("projects")
    .select("budget, budget_alert_threshold")
    .eq("id", projectId)
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (!project?.budget) return null

  const { data: invoices } = await supabase
    .from("invoices")
    .select("total")
    .eq("project_id", projectId)
    .eq("tenant_id", tenantId)
    .neq("status", "rejected")

  const spent = (invoices ?? []).reduce(
    (sum, i) => sum + Number(i.total ?? 0),
    0,
  )
  const budget = Number(project.budget)
  const threshold = project.budget_alert_threshold ?? 80
  const pct = budget > 0 ? (spent / budget) * 100 : 0

  return {
    spent,
    budget,
    threshold,
    pct,
    overBudget: pct >= 100,
    overThreshold: pct >= threshold,
  }
}

/** Sugere o próximo código sequencial para projetos (ex: PR-2026-001). */
export function generateProjectCode(
  type: string,
  existingCount: number,
  date: Date = new Date(),
): string {
  const prefix =
    type === "obra"
      ? "OB"
      : type === "departamento"
      ? "DEP"
      : type === "cliente"
      ? "CL"
      : "PR"
  const year = date.getFullYear()
  const seq = String(existingCount + 1).padStart(3, "0")
  return `${prefix}-${year}-${seq}`
}
