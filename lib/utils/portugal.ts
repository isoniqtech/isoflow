export function validateNIF(nif: string): boolean {
  if (!/^\d{9}$/.test(nif)) return false
  const digits = nif.split("").map(Number)
  let sum = 0
  for (let i = 0; i < 8; i++) sum += digits[i] * (9 - i)
  const remainder = sum % 11
  const check = remainder < 2 ? 0 : 11 - remainder
  return check === digits[8]
}

export const VAT_RATES = {
  normal: 23,
  intermediate: 13,
  reduced: 6,
  exempt: 0,
} as const

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(
    value,
  )

export const formatDate = (input: string | Date) =>
  new Intl.DateTimeFormat("pt-PT").format(
    typeof input === "string" ? new Date(input) : input,
  )

export const formatDateTime = (input: string | Date) =>
  new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(typeof input === "string" ? new Date(input) : input)

/**
 * Parse de número que aceita formato português ("1.234,56" ou "1234,56") e
 * inglês ("1234.56"). Devolve NaN se não conseguir interpretar.
 *
 *  "1230"        → 1230
 *  "1230,00"     → 1230
 *  "1.230"       → 1230   (ponto = separador de milhar)
 *  "1.230,00"    → 1230
 *  "1230.00"     → 1230   (ponto = decimal, regra americana)
 *  "1.000.000"   → 1000000
 *  "1.000.000,5" → 1000000.5
 */
export function parseDecimal(input: string): number {
  const s = input.trim()
  if (!s) return NaN

  const hasDot = s.includes(".")
  const hasComma = s.includes(",")

  let normalized: string
  if (hasDot && hasComma) {
    normalized = s.replace(/\./g, "").replace(",", ".")
  } else if (hasComma) {
    normalized = s.replace(",", ".")
  } else if (hasDot) {
    const parts = s.split(".")
    const last = parts[parts.length - 1]
    if (parts.length === 2 && last.length > 0 && last.length <= 2) {
      normalized = s
    } else {
      normalized = s.replace(/\./g, "")
    }
  } else {
    normalized = s
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return NaN
  return parseFloat(normalized)
}
