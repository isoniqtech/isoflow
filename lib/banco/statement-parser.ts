/**
 * Parser de extratos bancários — suporta Excel (.xlsx/.xls), CSV e PDF.
 * Tenta detetar automaticamente as colunas de data, descrição e valor.
 */

export type ParsedTransaction = {
  date: string        // YYYY-MM-DD
  description: string
  amount: number      // positivo = crédito, negativo = débito
  raw: string         // linha original (para debug)
}

export type ParseResult = {
  transactions: ParsedTransaction[]
  errors: string[]
  format: "excel" | "csv" | "pdf"
  rowsScanned: number
}

// ── Utilidades ───────────────────────────────────────────────────────────────

function parsePortugueseDate(raw: string): string | null {
  if (!raw) return null
  const s = raw.toString().trim()

  // DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
  const dmY = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
  if (dmY) {
    const [, d, m, y] = dmY
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
  // YYYY-MM-DD (ISO)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return s

  // Excel serial date (number)
  const n = parseFloat(s)
  if (!isNaN(n) && n > 40000 && n < 60000) {
    // Excel date serial → JS date (Excel epoch: 1899-12-30)
    const d = new Date((n - 25569) * 86400 * 1000)
    const y = d.getUTCFullYear()
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")
    return `${y}-${mo}-${day}`
  }

  return null
}

function parseAmount(raw: string | number): number | null {
  if (raw === null || raw === undefined || raw === "") return null
  if (typeof raw === "number") return raw
  // Remove espaços, símbolos de moeda
  let s = raw.toString().replace(/[€$£\s]/g, "").trim()
  // Formato PT: 1.234,56 → 1234.56
  if (/\d{1,3}(\.\d{3})*(,\d{2})?$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".")
  } else {
    // Formato EN: 1,234.56
    s = s.replace(/,/g, "")
  }
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function isDateCell(val: unknown): boolean {
  if (!val) return false
  const s = String(val).trim()
  return (
    /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(s) ||
    /^\d{4}-\d{2}-\d{2}$/.test(s) ||
    (parseFloat(s) > 40000 && parseFloat(s) < 60000)
  )
}

// ── Detector de colunas ──────────────────────────────────────────────────────
// Recebe uma array de rows (arrays de células) e tenta mapear colunas

type ColumnMap = {
  dateCol: number
  descCol: number
  debitCol: number | null   // coluna de débito (saída)
  creditCol: number | null  // coluna de crédito (entrada)
  amountCol: number | null  // coluna de valor único (pode ser negativo)
  headerRow: number
}

const DATE_HEADERS = ["data", "date", "mov", "data mov", "data valor", "data de movimento"]
const DESC_HEADERS = ["descri", "histór", "movement", "narrat", "designa", "observ", "detalh", "memo"]
const DEBIT_HEADERS = ["débito", "debito", "saída", "saida", "debit", "out"]
const CREDIT_HEADERS = ["crédito", "credito", "entrada", "credit", "in", "depósito"]
const AMOUNT_HEADERS = ["valor", "amount", "montante", "quantia", "importância", "import"]

function detectColumns(rows: unknown[][]): ColumnMap | null {
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const row = rows[r].map((c) => String(c ?? "").toLowerCase().trim())
    const hasDate = row.some((c) => DATE_HEADERS.some((h) => c.includes(h)))
    if (!hasDate) continue

    const dateCol = row.findIndex((c) => DATE_HEADERS.some((h) => c.includes(h)))
    const descCol = row.findIndex((c) => DESC_HEADERS.some((h) => c.includes(h)))
    const debitCol = row.findIndex((c) => DEBIT_HEADERS.some((h) => c === h || c.startsWith(h)))
    const creditCol = row.findIndex((c) => CREDIT_HEADERS.some((h) => c === h || c.startsWith(h)))
    const amountCol = row.findIndex((c) => AMOUNT_HEADERS.some((h) => c === h || c.startsWith(h)))

    if (dateCol === -1) continue

    return {
      dateCol,
      descCol: descCol >= 0 ? descCol : (dateCol + 1),
      debitCol: debitCol >= 0 ? debitCol : null,
      creditCol: creditCol >= 0 ? creditCol : null,
      amountCol: amountCol >= 0 ? amountCol : null,
      headerRow: r,
    }
  }

  // Fallback: detect by data content — find first row where column 0 looks like a date
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r]
    if (row.length >= 3 && isDateCell(row[0])) {
      return {
        dateCol: 0,
        descCol: 1,
        debitCol: null,
        creditCol: null,
        amountCol: 2,
        headerRow: r - 1 < 0 ? -1 : r - 1,
      }
    }
  }

  return null
}

function rowsToTransactions(rows: unknown[][], map: ColumnMap): { txs: ParsedTransaction[]; errors: string[] } {
  const txs: ParsedTransaction[] = []
  const errors: string[] = []
  const startRow = Math.max(map.headerRow + 1, 0)

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.every((c) => !c)) continue

    const rawDate = row[map.dateCol]
    const date = parsePortugueseDate(String(rawDate ?? ""))
    if (!date) continue

    const description = String(row[map.descCol] ?? "").trim()

    let amount: number | null = null
    if (map.debitCol !== null || map.creditCol !== null) {
      const debit = map.debitCol !== null ? parseAmount(row[map.debitCol] as string) : null
      const credit = map.creditCol !== null ? parseAmount(row[map.creditCol] as string) : null
      if (credit && credit !== 0) amount = Math.abs(credit)
      else if (debit && debit !== 0) amount = -Math.abs(debit)
    } else if (map.amountCol !== null) {
      amount = parseAmount(row[map.amountCol] as string)
    } else {
      // Try all numeric columns after date and desc
      for (let c = 2; c < row.length; c++) {
        const v = parseAmount(row[c] as string)
        if (v !== null && v !== 0) { amount = v; break }
      }
    }

    if (amount === null) {
      errors.push(`Linha ${r + 1}: valor não reconhecido`)
      continue
    }

    txs.push({
      date,
      description: description || "—",
      amount,
      raw: row.join(" | "),
    })
  }

  return { txs, errors }
}

// ── Excel ────────────────────────────────────────────────────────────────────

export async function parseExcel(buffer: ArrayBuffer): Promise<ParseResult> {
  const XLSX = await import("xlsx")
  const wb = XLSX.read(buffer, { type: "array", cellDates: false })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true })

  const map = detectColumns(rows)
  if (!map) {
    return { transactions: [], errors: ["Não foi possível detetar colunas de data/valor. Verifica o formato do ficheiro."], format: "excel", rowsScanned: rows.length }
  }

  const { txs, errors } = rowsToTransactions(rows, map)
  return { transactions: txs, errors, format: "excel", rowsScanned: rows.length }
}

// ── CSV ──────────────────────────────────────────────────────────────────────

export async function parseCsv(text: string): Promise<ParseResult> {
  const Papa = await import("papaparse")
  const result = Papa.default.parse<unknown[]>(text, {
    skipEmptyLines: true,
    delimiter: "",       // auto-detect
  })

  const rows = result.data as unknown[][]
  const map = detectColumns(rows)
  if (!map) {
    return { transactions: [], errors: ["Não foi possível detetar colunas. Verifica o separador (vírgula ou ponto-e-vírgula)."], format: "csv", rowsScanned: rows.length }
  }

  const { txs, errors } = rowsToTransactions(rows, map)
  return { transactions: txs, errors, format: "csv", rowsScanned: rows.length }
}

// ── PDF ──────────────────────────────────────────────────────────────────────

export async function parsePdf(buffer: ArrayBuffer): Promise<ParseResult> {
  try {
    const { PDFParse } = await import("pdf-parse")
    /* eslint-disable */
    const parser = new (PDFParse as any)({ buffer: Buffer.from(buffer) })
    const result = await parser.getText()
    const text = (result as { text: string }).text
    /* eslint-enable */

    // Split by lines and try to find transaction rows
    const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean)
    const rows: unknown[][] = lines.map((line: string) => line.split(/\s{2,}|\t/))

    const map = detectColumns(rows)
    if (!map) {
      // Fallback: regex scan for date + amount patterns
      const txs: ParsedTransaction[] = []
      const errors: string[] = ["Formato PDF não reconhecido automaticamente — a usar deteção por padrão."]

      const dateAmountRe = /(\d{2}[\/\-]\d{2}[\/\-]\d{4})\s+(.+?)\s+([-+]?\d[\d.,]+)\s*(?:EUR|€)?/g
      let match
      while ((match = dateAmountRe.exec(text)) !== null) {
        const date = parsePortugueseDate(match[1])
        if (!date) continue
        const amount = parseAmount(match[3])
        if (amount === null) continue
        txs.push({ date, description: match[2].trim(), amount, raw: match[0] })
      }

      return { transactions: txs, errors, format: "pdf", rowsScanned: lines.length }
    }

    const { txs, errors } = rowsToTransactions(rows, map)
    return { transactions: txs, errors, format: "pdf", rowsScanned: rows.length }
  } catch (e) {
    return {
      transactions: [],
      errors: [`Erro ao ler PDF: ${e instanceof Error ? e.message : String(e)}`],
      format: "pdf",
      rowsScanned: 0,
    }
  }
}
