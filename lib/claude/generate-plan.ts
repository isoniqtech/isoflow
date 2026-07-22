/**
 * Geração de um cronograma de projeto com IA.
 *
 * Usa a chave e o modelo do tenant (resolveAnthropicConfig), tal como a
 * extração de faturas e a escolha de categoria de gasto.
 *
 * O prompt exige JSON puro. Mesmo assim fazemos parse defensivo (limpeza de
 * fences), porque confiar cegamente no formato do modelo é o erro clássico.
 */

import Anthropic from "@anthropic-ai/sdk"
import type { AnthropicConfig } from "@/lib/claude/extract-invoice"

export const TASK_STATUSES = ["por_iniciar", "em_curso", "concluida", "bloqueada"] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export interface TarefaGerada {
  title: string
  description: string | null
  start_date: string | null
  end_date: string | null
  status: TaskStatus
}

export interface ContextoProjeto {
  nome: string
  tipo?: string | null
  descricao?: string | null
  start_date?: string | null
  end_date?: string | null
}

const SYSTEM = `És um gestor de obra e de projetos português. Recebes a descrição de um projeto e devolves um cronograma de tarefas.

Responde APENAS com JSON válido. Sem markdown, sem backticks, sem preâmbulo, sem explicação.

Formato obrigatório: um array de objetos com exatamente estes campos:
[
  {
    "title": "string, curto e acionável",
    "description": "string ou null, uma frase a explicar o que envolve",
    "start_date": "YYYY-MM-DD ou null",
    "end_date": "YYYY-MM-DD ou null",
    "status": "por_iniciar" | "em_curso" | "concluida" | "bloqueada"
  }
]

Regras:
- Entre 4 e 15 tarefas, por ordem cronológica.
- As datas têm de ser coerentes: end_date nunca antes de start_date, e as tarefas encadeiam-se de forma realista.
- Se o projeto tiver datas de início e fim, mantém o cronograma dentro desse intervalo.
- Se não houver informação para datar, usa null em vez de inventar.
- status é "por_iniciar" salvo indicação explícita do contrário.
- Escreve em português de Portugal.`

/** Extrai o array JSON da resposta, tolerando fences ou texto à volta. */
function extrairJson(texto: string): unknown {
  const limpo = texto
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()

  try {
    return JSON.parse(limpo)
  } catch {
    // Última tentativa: apanhar o primeiro array que apareça no texto
    const inicio = limpo.indexOf("[")
    const fim = limpo.lastIndexOf("]")
    if (inicio !== -1 && fim > inicio) {
      try {
        return JSON.parse(limpo.slice(inicio, fim + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/

/** Valida e normaliza o que o modelo devolveu. Descarta o que não presta. */
function normalizar(bruto: unknown): TarefaGerada[] {
  if (!Array.isArray(bruto)) return []

  const tarefas: TarefaGerada[] = []
  for (const item of bruto) {
    const o = (item ?? {}) as Record<string, unknown>
    const title = typeof o.title === "string" ? o.title.trim() : ""
    if (!title) continue

    const status = TASK_STATUSES.includes(o.status as TaskStatus)
      ? (o.status as TaskStatus)
      : "por_iniciar"

    let start = typeof o.start_date === "string" && DATA_RE.test(o.start_date) ? o.start_date : null
    let end = typeof o.end_date === "string" && DATA_RE.test(o.end_date) ? o.end_date : null
    // Coerência: se as datas vierem trocadas, corrige em vez de gravar lixo
    if (start && end && end < start) [start, end] = [end, start]

    tarefas.push({
      title: title.slice(0, 200),
      description:
        typeof o.description === "string" && o.description.trim()
          ? o.description.trim().slice(0, 1000)
          : null,
      start_date: start,
      end_date: end,
      status,
    })
  }
  return tarefas.slice(0, 30)
}

/**
 * Gera o cronograma. Devolve [] se o modelo não produzir nada aproveitável
 * (o caller mostra a mensagem ao utilizador).
 */
export async function generateProjectPlan(
  descricao: string,
  projeto: ContextoProjeto,
  config?: AnthropicConfig,
): Promise<TarefaGerada[]> {
  const contexto = [
    `Projeto: ${projeto.nome}`,
    projeto.tipo ? `Tipo: ${projeto.tipo}` : null,
    projeto.descricao ? `Descrição do projeto: ${projeto.descricao}` : null,
    projeto.start_date ? `Início previsto: ${projeto.start_date}` : null,
    projeto.end_date ? `Fim previsto: ${projeto.end_date}` : null,
    "",
    "O que o utilizador pretende planear:",
    descricao,
  ]
    .filter(Boolean)
    .join("\n")

  const client = new Anthropic(config?.apiKey ? { apiKey: config.apiKey } : {})
  const response = await client.messages.create({
    model: config?.model ?? "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: "user", content: contexto }],
  })

  const texto = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")

  return normalizar(extrairJson(texto))
}
