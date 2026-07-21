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

    if (amount === null || amount === 0) {
      // Linha com valor 0 ou não reconhecido - ignorar silenciosamente
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

// Regex para valor monetário em formato PT: 1.234,56 ou 1234,56 ou 10,40 (saldo pode ser negativo)
const PT_AMOUNT_RE = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g

/**
 * Parser específico para extratos PT com colunas DÉBITO / CRÉDITO / SALDO separadas.
 * Usa a diferença de saldo entre linhas para inferir o sinal do movimento.
 * Funciona com CA (Crédito Agrícola), CGD, BPI e formatos similares.
 */
function parseBankTextWithBalance(text: string): { txs: ParsedTransaction[]; errors: string[] } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const txs: ParsedTransaction[] = []
  const errors: string[] = []

  // Padrão: linha começa com data (DD-MM-YYYY ou DD/MM/YYYY) - pode ter 1 ou 2 datas
  const DATE_PREFIX = /^(\d{2}[-\/]\d{2}[-\/]\d{4})\s+(?:\d{2}[-\/]\d{2}[-\/]\d{4}\s+)?(.+)$/

  let prevBalance: number | null = null

  for (const line of lines) {
    const m = line.match(DATE_PREFIX)
    if (!m) continue

    const dateStr = m[1]
    const rest = m[2].trim()

    // Extrair todos os valores monetários PT presentes na linha
    const amounts = [...rest.matchAll(new RegExp(PT_AMOUNT_RE.source, "g"))].map((a) => parseAmount(a[0]))
    if (amounts.length === 0) continue

    // Último valor = saldo corrente; penúltimo = montante da transação
    const balance = amounts[amounts.length - 1]
    if (balance === null) continue

    if (amounts.length < 2) {
      // Linha sem transação (ex: saldo inicial, totais)
      prevBalance = balance
      continue
    }

    const txAmount = amounts[amounts.length - 2]
    if (txAmount === null || txAmount === 0) {
      prevBalance = balance
      continue
    }

    // Descrição = tudo antes do primeiro valor monetário
    const firstAmountIdx = rest.search(/\d{1,3}(?:\.\d{3})*,\d{2}/)
    const description = (firstAmountIdx > 0 ? rest.slice(0, firstAmountIdx) : rest).trim()

    // Usar diferença de saldo para determinar sinal (crédito ou débito)
    let signedAmount: number
    if (prevBalance !== null) {
      const diff = balance - prevBalance
      if (Math.abs(diff - txAmount) < 0.02) {
        signedAmount = txAmount       // crédito (saldo subiu)
      } else if (Math.abs(diff + txAmount) < 0.02) {
        signedAmount = -txAmount      // débito (saldo baixou)
      } else {
        // Diferença não bate — guardar com sinal negativo e avisar
        signedAmount = -txAmount
        errors.push(`Linha "${line.slice(0, 60)}": saldo não confere, assumido débito`)
      }
    } else {
      // Sem saldo anterior não conseguimos inferir — assumir negativo (mais conservador)
      signedAmount = -txAmount
    }

    const date = parsePortugueseDate(dateStr)
    if (!date) continue

    txs.push({ date, description: description || "—", amount: signedAmount, raw: line })
    prevBalance = balance
  }

  return { txs, errors }
}

// ── BPI (extrato colunar) ─────────────────────────────────────────────────────
// Caminho DEDICADO e ADITIVO para extratos do Banco BPI. O `unpdf` extrai o PDF
// do BPI coluna-a-coluna (descrições juntas, depois saldos, depois datas, depois
// valores), e as datas são DD/MM sem ano — o parser genérico não os apanha.
// Esta lógica só corre quando o texto é reconhecido como BPI; qualquer outro
// banco/formato ignora este bloco. Nunca alterar os parsers acima.

const BPI_MONEY_RE = /^-?\d{1,3}(?:[ .]\d{3})*,\d{2}$/
const BPI_DATE_RE = /^\d{1,2}\/\d{1,2}$/
const BPI_SALDO_LABEL_RE = /^SALDO\s+(ANTERIOR|ACTUAL|ATUAL|DISPON)/i

export function isBpiStatement(text: string): boolean {
  return /BANCO BPI|BBPIPTPL|bancobpi/i.test(text)
}

// Valor PT tolerante a milhares por espaço OU ponto, decimal por vírgula.
// Local ao BPI para não mexer no parseAmount partilhado por outros bancos.
function parseBpiAmount(s: string): number | null {
  const neg = /^\s*-/.test(s)
  const t = s.replace(/[^\d,]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")
  const n = Number(t)
  if (isNaN(n)) return null
  return neg ? -n : n
}

type BpiPeriod = { y1: number; y2: number; m1: number; m2: number }

function inferBpiPeriod(text: string): BpiPeriod {
  const m = text.match(/De\s+(\d{2})\/(\d{2})\/(\d{4})\s+a\s+(\d{2})\/(\d{2})\/(\d{4})/i)
  if (!m) {
    const y = text.match(/\b(20\d{2})\b/)
    const yy = y ? Number(y[1]) : new Date().getFullYear()
    return { y1: yy, y2: yy, m1: 1, m2: 12 }
  }
  return { y1: Number(m[3]), y2: Number(m[6]), m1: Number(m[2]), m2: Number(m[5]) }
}

// Extrato pode cruzar o ano (Dez→Jan): escolhe o ano certo pelo mês.
function bpiYearForMonth(mm: number, p: BpiPeriod): number {
  if (p.y1 === p.y2) return p.y1
  return mm >= p.m1 ? p.y1 : p.y2
}

function bpiMoneyRuns(lines: string[]): { start: number; items: string[] }[] {
  const runs: { start: number; items: string[] }[] = []
  let cur: { start: number; items: string[] } | null = null
  lines.forEach((l, i) => {
    if (BPI_MONEY_RE.test(l)) {
      if (!cur) { cur = { start: i, items: [] }; runs.push(cur) }
      cur.items.push(l)
    } else {
      cur = null
    }
  })
  return runs
}

type BpiTx = { date: string; description: string; amount: number; balance: number | null }

function parseBpiPage(pageText: string, period: BpiPeriod): { txs: BpiTx[]; saldoAnterior: number | null } | null {
  const lines = pageText.split("\n").map((l) => l.trim()).filter(Boolean)
  const dateIdxs = lines.map((l, i) => (BPI_DATE_RE.test(l) ? i : -1)).filter((i) => i >= 0)
  if (!dateIdxs.length) return null

  const firstDateIdx = dateIdxs[0]
  const lastDateIdx = dateIdxs[dateIdxs.length - 1]
  const runs = bpiMoneyRuns(lines)
  if (!runs.length) return null

  // Estrutura colunar do BPI: SALDO vem antes das datas, VALOR depois.
  const amountRun = runs.find((r) => r.start > lastDateIdx)
  const balanceRun = [...runs].reverse().find((r) => r.start < firstDateIdx)
  if (!amountRun) return null

  const n = amountRun.items.length
  if (n === 0) return null

  // DATA VAL = as últimas N datas (o bloco DATA MOV, deduplicado por dia, vem antes).
  const valDates = dateIdxs.map((i) => lines[i]).slice(-n)
  if (valDates.length !== n) return null

  // Descrições = linhas de texto antes do 1º bloco de valores, sem rótulos de saldo, últimas N.
  const descriptions = lines
    .slice(0, runs[0].start)
    .filter((l) => !BPI_DATE_RE.test(l) && !BPI_MONEY_RE.test(l) && !BPI_SALDO_LABEL_RE.test(l))
    .slice(-n)

  const balVals = (balanceRun ? balanceRun.items : []).map(parseBpiAmount)
  const hasAnterior = /SALDO\s+ANTERIOR/i.test(pageText)
  const saldoAnterior = hasAnterior && balVals.length ? balVals[0] : null
  const txBalances = (hasAnterior ? balVals.slice(1) : balVals).slice(0, n)

  const txs: BpiTx[] = []
  for (let i = 0; i < n; i++) {
    const [dd, mm] = valDates[i].split("/")
    const year = bpiYearForMonth(Number(mm), period)
    const amount = parseBpiAmount(amountRun.items[i])
    if (amount === null) continue
    txs.push({
      date: `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`,
      description: descriptions[i] || "—",
      amount,
      balance: txBalances[i] ?? null,
    })
  }
  return { txs, saldoAnterior }
}

export function parseBpiStatement(pages: string[]): ParseResult {
  const period = inferBpiPeriod(pages.join("\n"))
  const rowsScanned = pages.join("\n").split("\n").filter((l) => l.trim()).length

  let all: BpiTx[] = []
  let saldoAnterior: number | null = null
  for (const p of pages) {
    const r = parseBpiPage(p, period)
    if (!r) continue
    if (r.saldoAnterior !== null && saldoAnterior === null) saldoAnterior = r.saldoAnterior
    all = all.concat(r.txs)
  }

  if (all.length === 0) {
    return {
      transactions: [],
      errors: ["Extrato BPI reconhecido mas não foi possível extrair movimentos. Verifica o PDF."],
      format: "pdf",
      rowsScanned,
    }
  }

  // Validação por cadeia de saldos: saldo[i] = saldo[i-1] + valor[i].
  const errors: string[] = []
  let prev: number | null = saldoAnterior
  for (let i = 0; i < all.length; i++) {
    const t = all[i]
    if (prev !== null && t.balance !== null) {
      const expected = Math.round((prev + t.amount) * 100) / 100
      if (Math.abs(expected - t.balance) > 0.01) {
        errors.push(`Linha ${i + 1} (${t.date}): saldo esperado ${expected.toFixed(2)} difere do extraído ${t.balance.toFixed(2)}`)
      }
      prev = t.balance
    } else if (prev !== null) {
      prev = Math.round((prev + t.amount) * 100) / 100
    }
  }

  // Reconciliação global: saldo anterior + soma dos movimentos == saldo final.
  const soma = all.reduce((s, t) => s + t.amount, 0)
  const saldoActual = all[all.length - 1].balance
  if (saldoAnterior !== null && saldoActual !== null) {
    const diff = Math.abs(saldoAnterior + soma - saldoActual)
    if (diff > 0.02) {
      // Não reconcilia: recusa a importação para não gravar dados errados.
      return {
        transactions: [],
        errors: [
          `Extrato BPI não reconcilia: saldo anterior ${saldoAnterior.toFixed(2)} + movimentos ${soma.toFixed(2)} = ${(saldoAnterior + soma).toFixed(2)}, mas saldo final é ${saldoActual.toFixed(2)}. Importação cancelada para evitar dados incorretos.`,
          ...errors,
        ],
        format: "pdf",
        rowsScanned,
      }
    }
  }

  const transactions: ParsedTransaction[] = all.map((t) => ({
    date: t.date,
    description: t.description,
    amount: t.amount,
    raw: `${t.date} | ${t.description} | ${t.amount.toFixed(2)}`,
  }))

  return { transactions, errors, format: "pdf", rowsScanned }
}

export async function parsePdf(buffer: ArrayBuffer): Promise<ParseResult> {
  try {
    const { extractText } = await import("unpdf")
    const { text: pages } = await extractText(new Uint8Array(buffer))
    const pageArr: string[] = Array.isArray(pages) ? pages.map(String) : [String(pages)]
    const text = pageArr.join("\n")

    // Caminho dedicado BPI (aditivo). Só dispara em extratos BPI reconhecidos;
    // qualquer outro banco cai na lógica genérica abaixo, inalterada.
    if (isBpiStatement(text)) {
      return parseBpiStatement(pageArr)
    }

    const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean)

    // Tentar parser estruturado com saldo
    const { txs: balanceTxs, errors: balanceErrors } = parseBankTextWithBalance(text)
    if (balanceTxs.length > 0) {
      return { transactions: balanceTxs, errors: balanceErrors, format: "pdf", rowsScanned: lines.length }
    }

    // Fallback 1: deteção de colunas por cabeçalho
    const rows: unknown[][] = lines.map((line: string) => line.split(/\s{2,}|\t/))
    const map = detectColumns(rows)
    if (map) {
      const { txs, errors } = rowsToTransactions(rows, map)
      return { transactions: txs, errors, format: "pdf", rowsScanned: rows.length }
    }

    // Fallback 2: regex data + montante
    const txs: ParsedTransaction[] = []
    const errors: string[] = ["Formato PDF não reconhecido automaticamente - a usar deteção por padrão."]
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
  } catch (e) {
    return {
      transactions: [],
      errors: [`Erro ao ler PDF: ${e instanceof Error ? e.message : String(e)}`],
      format: "pdf",
      rowsScanned: 0,
    }
  }
}
