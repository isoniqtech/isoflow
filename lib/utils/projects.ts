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

type ProjectRow = { id: string; name: string; name_aliases: string[] | null }

function matchByString(text: string, projects: ProjectRow[]): string | null {
  const haystack = ` ${normalize(text)} `
  for (const project of projects) {
    const candidates = [project.name, ...(project.name_aliases ?? [])]
      .filter((c): c is string => Boolean(c))
      .map(normalize)
      .filter((c) => c.length >= 2)
    for (const candidate of candidates) {
      if (haystack.includes(` ${candidate} `)) return project.id
    }
  }
  return null
}

async function matchByAI(text: string, projects: ProjectRow[]): Promise<string | null> {
  if (!text?.trim()) return null
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const client = new Anthropic()

    const projectList = projects
      .map((p) => {
        const aliases = p.name_aliases?.length ? ` (tambem: ${p.name_aliases.join(", ")})` : ""
        return `${p.id}: ${p.name}${aliases}`
      })
      .join("\n")

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: `Analisa este email e determina se menciona explicitamente um projeto ou obra ao qual as faturas devem ser associadas.

Email:
${text.slice(0, 1500)}

Projetos disponiveis (ID: Nome):
${projectList}

Responde APENAS com o UUID do projeto mencionado, ou a palavra "null" se nenhum projeto for claramente identificado. Sem texto adicional.`,
        },
      ],
    })

    const answer = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim()

    if (!answer || answer === "null") return null

    // Validar que o ID devolvido corresponde a um projeto real
    return projects.find((p) => p.id === answer)?.id ?? null
  } catch {
    return null
  }
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

  return matchByString(text, projects)
}

/**
 * Versao com fallback via IA: tenta string-match primeiro (rapido, sem custo),
 * e se nao encontrar usa Claude Haiku para interpretar mencoes naturais de
 * projeto no texto (ex: "estas faturas sao para a obra do Mercado").
 * Usar em contextos de email/WhatsApp onde o remetente pode mencionar o
 * projeto em linguagem natural.
 */
export async function matchProjectFromTextWithAI(
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

  return matchByString(text, projects) ?? matchByAI(text, projects)
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
