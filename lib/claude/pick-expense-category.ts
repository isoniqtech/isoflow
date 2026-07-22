/**
 * Escolha da categoria de gasto (TOConline) para uma fatura, feita pela IA.
 *
 * Chamada leve e separada da extracao principal, para nao mexer no contrato
 * JSON dessa extracao. Devolve sempre um codigo valido do catalogo do tenant,
 * ou null se nao for possivel decidir (o caller usa o fallback).
 */

import Anthropic from "@anthropic-ai/sdk"
import type { ExpenseCategory } from "@/lib/toconline/expense-categories"
import type { AnthropicConfig } from "@/lib/claude/extract-invoice"

export interface InvoiceHint {
  supplier_name?: string | null
  description?: string | null
  category?: string | null
  total?: number | null
  vat_rate?: number | null
}

/** Converte a taxa de IVA da fatura no tax_code do TOConline (PT). */
function taxCodeFromRate(rate: number | null | undefined): string | null {
  if (rate === null || rate === undefined) return null
  const r = Number(rate)
  if (!Number.isFinite(r)) return null
  if (r === 0) return "ISE"
  if (r <= 6) return "RED"
  if (r <= 13) return "INT"
  return "NOR"
}

/**
 * Pede ao Claude a melhor categoria do catalogo para esta fatura.
 * Devolve o `code` escolhido (garantidamente existente no catalogo) ou null.
 */
export async function pickExpenseCategory(
  invoice: InvoiceHint,
  categories: ExpenseCategory[],
  config?: AnthropicConfig,
): Promise<string | null> {
  if (categories.length === 0) return null

  const validos = new Set(categories.map((c) => c.code))

  // Catalogo compacto: codigo | nome | iva
  const catalogo = categories
    .map((c) => `${c.code} | ${c.name}${c.tax_code ? ` | IVA ${c.tax_code}` : ""}`)
    .join("\n")

  const ivaFatura = taxCodeFromRate(invoice.vat_rate)
  const resumo = [
    invoice.supplier_name ? `Fornecedor: ${invoice.supplier_name}` : null,
    invoice.description ? `Descricao: ${invoice.description}` : null,
    invoice.category ? `Tipo detectado: ${invoice.category}` : null,
    invoice.total !== null && invoice.total !== undefined ? `Total: ${invoice.total} EUR` : null,
    invoice.vat_rate !== null && invoice.vat_rate !== undefined
      ? `IVA: ${invoice.vat_rate}%${ivaFatura ? ` (${ivaFatura})` : ""}`
      : null,
  ]
    .filter(Boolean)
    .join("\n")

  const prompt = `Es um contabilista portugues. Escolhe a categoria de gasto mais adequada para esta fatura de compra, a partir do plano de contas da empresa.

FATURA:
${resumo}

CATALOGO (codigo | nome | IVA associado):
${catalogo}

Regras:
- Responde APENAS com o codigo escolhido, sem texto, sem aspas, sem explicacao.
- O codigo tem de existir exactamente no catalogo acima.
- Prefere a categoria mais especifica que corresponda ao gasto (ex: uma refeicao num restaurante vai para a conta de refeicoes, nao para servicos genericos).
- Em caso de duvida entre duas, prefere aquela cujo IVA associado coincide com o IVA da fatura.`

  try {
    const client = new Anthropic(config?.apiKey ? { apiKey: config.apiKey } : {})
    const response = await client.messages.create({
      model: config?.model ?? "claude-sonnet-4-20250514",
      max_tokens: 20,
      messages: [{ role: "user", content: prompt }],
    })

    const texto = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim()

    // Aceitar apenas um codigo que exista mesmo no catalogo
    const limpo = texto.replace(/[^\w.]/g, "")
    if (validos.has(limpo)) return limpo

    // O modelo pode devolver o codigo dentro de outro texto
    for (const c of categories) {
      if (texto.includes(c.code)) return c.code
    }
    return null
  } catch {
    return null
  }
}
