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

export interface SubtarefaGerada {
  title: string
  description: string | null
  start_date: string | null
  end_date: string | null
  status: TaskStatus
}

export interface TarefaGerada extends SubtarefaGerada {
  /** Nome da fase a que a tarefa pertence. Agrupa as barras no Gantt. */
  phase: string | null
  /** Ordem da fase no cronograma (0, 1, 2...). Null se não houver fase. */
  phase_order: number | null
  /** Terceiro nível: passos concretos da tarefa macro. Pode vir vazio. */
  subtarefas: SubtarefaGerada[]
}

export interface ContextoProjeto {
  nome: string
  tipo?: string | null
  descricao?: string | null
  start_date?: string | null
  end_date?: string | null
}

const SYSTEM = `És um gestor de obra e de projetos português. Recebes a descrição de um projeto e devolves um cronograma de tarefas organizado por fases.

Responde APENAS com JSON válido. Sem markdown, sem backticks, sem preâmbulo, sem explicação.

O cronograma tem TRÊS níveis: fase > tarefa > subtarefa.
Exemplo: "Fase 1 - Fundações" > "Movimentação de terras" > "Alugar máquinas", "Escavar", "Remover entulho".

Formato obrigatório: um array de objetos com exatamente estes campos:
[
  {
    "phase": "string, nome da fase (ex: \\"Fase 1 - Fundações\\")",
    "phase_order": 0,
    "title": "string, tarefa macro, curta e acionável",
    "description": "string ou null, uma frase a explicar o que envolve",
    "start_date": "YYYY-MM-DD ou null",
    "end_date": "YYYY-MM-DD ou null",
    "status": "por_iniciar" | "em_curso" | "concluida" | "bloqueada",
    "subtarefas": [
      {
        "title": "string, passo concreto",
        "description": "string ou null",
        "start_date": "YYYY-MM-DD ou null",
        "end_date": "YYYY-MM-DD ou null",
        "status": "por_iniciar" | "em_curso" | "concluida" | "bloqueada"
      }
    ]
  }
]

Regras sobre fases:
- Organiza o trabalho em 3 a 6 fases, por ordem cronológica.
- phase_order começa em 0 e é o mesmo número para todas as tarefas da mesma fase.
- phase é EXATAMENTE a mesma string para todas as tarefas da mesma fase. Formato "Fase N - Nome curto", com N a começar em 1.
- Cada fase tem 2 a 5 tarefas macro.

Regras sobre tarefas macro:
- Entre 6 e 20 tarefas macro no total, por ordem cronológica.
- Cada uma tem 2 a 5 subtarefas. Se a tarefa for mesmo indivisível, devolve "subtarefas": [].

Regras sobre subtarefas:
- São passos concretos e executáveis, não repetições do título da tarefa macro.
- Têm de caber dentro do período da tarefa macro a que pertencem.

Regras sobre datas e estados:
- As datas têm de ser coerentes: end_date nunca antes de start_date, e o trabalho encadeia-se de forma realista.
- As tarefas de uma fase têm de ficar dentro do período dessa fase, e as fases não se sobrepõem, salvo quando o trabalho é mesmo em paralelo.
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

/** Campos comuns a tarefas e subtarefas. Devolve null se não houver título. */
function normalizarBase(bruto: unknown): SubtarefaGerada | null {
  const o = (bruto ?? {}) as Record<string, unknown>
  const title = typeof o.title === "string" ? o.title.trim() : ""
  if (!title) return null

  const status = TASK_STATUSES.includes(o.status as TaskStatus)
    ? (o.status as TaskStatus)
    : "por_iniciar"

  let start = typeof o.start_date === "string" && DATA_RE.test(o.start_date) ? o.start_date : null
  let end = typeof o.end_date === "string" && DATA_RE.test(o.end_date) ? o.end_date : null
  // Coerência: se as datas vierem trocadas, corrige em vez de gravar lixo
  if (start && end && end < start) [start, end] = [end, start]

  return {
    title: title.slice(0, 200),
    description:
      typeof o.description === "string" && o.description.trim()
        ? o.description.trim().slice(0, 1000)
        : null,
    start_date: start,
    end_date: end,
    status,
  }
}

/** Valida e normaliza o que o modelo devolveu. Descarta o que não presta. */
function normalizar(bruto: unknown): TarefaGerada[] {
  if (!Array.isArray(bruto)) return []

  const tarefas: TarefaGerada[] = []
  // O modelo pode esquecer-se do phase_order ou repeti-lo entre fases. A ordem
  // de aparecimento e' a fonte fiavel, ja' que exigimos ordem cronologica.
  const ordemPorFase = new Map<string, number>()

  for (const item of bruto) {
    const base = normalizarBase(item)
    if (!base) continue

    const o = (item ?? {}) as Record<string, unknown>
    const phase =
      typeof o.phase === "string" && o.phase.trim() ? o.phase.trim().slice(0, 120) : null
    if (phase && !ordemPorFase.has(phase)) ordemPorFase.set(phase, ordemPorFase.size)

    const subtarefas: SubtarefaGerada[] = []
    if (Array.isArray(o.subtarefas)) {
      for (const s of o.subtarefas) {
        const sub = normalizarBase(s)
        // Só 2 níveis de tarefa: uma "subtarefa" com subtarefas próprias é
        // achatada, o resto ignorado.
        if (sub) subtarefas.push(sub)
        if (subtarefas.length >= 10) break
      }
    }

    tarefas.push({
      ...base,
      phase,
      phase_order: phase ? (ordemPorFase.get(phase) ?? null) : null,
      subtarefas,
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
    // Com subtarefas a saída triplica; 4000 truncava o JSON a meio
    max_tokens: 12000,
    system: SYSTEM,
    messages: [{ role: "user", content: contexto }],
  })

  const texto = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")

  return normalizar(extrairJson(texto))
}
