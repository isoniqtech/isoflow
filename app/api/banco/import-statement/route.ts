import { NextResponse } from "next/server"
import { createHash } from "crypto"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"
import { parseExcel, parseCsv, parsePdf } from "@/lib/banco/statement-parser"
import type { BankAccountConfig } from "@/app/api/integracoes/banco/route"

function makeExternalId(tenantId: string, date: string, amount: number, description: string): string {
  return createHash("sha256")
    .update(`${tenantId}|${date}|${amount}|${description}`)
    .digest("hex")
    .slice(0, 32)
}

export async function POST(request: Request) {
  const session = await getCurrentSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const accountId = formData.get("account_id") as string | null

  if (!file) return NextResponse.json({ error: "Ficheiro obrigatório" }, { status: 400 })

  const fileName = file.name.toLowerCase()
  const buffer = await file.arrayBuffer()

  let parseResult
  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    parseResult = await parseExcel(buffer)
  } else if (fileName.endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(buffer)
    parseResult = await parseCsv(text)
  } else if (fileName.endsWith(".pdf")) {
    parseResult = await parsePdf(buffer)
  } else {
    const text = new TextDecoder("utf-8").decode(buffer)
    parseResult = await parseCsv(text)
  }

  if (parseResult.transactions.length === 0) {
    return NextResponse.json({
      imported: 0,
      skipped: 0,
      total: 0,
      errors: parseResult.errors,
      format: parseResult.format,
      rowsScanned: parseResult.rowsScanned,
    })
  }

  const supabase = createClient()

  // Obter info da conta configurada
  let accountName: string | null = null
  let bankName: string | null = null
  let iban: string | null = null

  if (accountId) {
    const { data: integration } = await supabase
      .from("tenant_integrations")
      .select("config")
      .eq("tenant_id", session.tenant.id)
      .eq("type", "banking")
      .eq("provider", "manual")
      .maybeSingle()

    if (integration?.config) {
      const accounts = (integration.config as { accounts?: BankAccountConfig[] }).accounts ?? []
      const account = accounts.find((a) => a.id === accountId)
      if (account) {
        accountName = account.label
        bankName = account.bank_name
        iban = account.iban
      }
    }
  }

  // Gerar external_ids para todas as transações parseadas
  const candidatos = parseResult.transactions.map((tx) => ({
    externalId: makeExternalId(session.tenant.id, tx.date, tx.amount, tx.description),
    tx,
  }))

  const allExternalIds = candidatos.map((c) => c.externalId)

  // Verificar quais já existem na DB (deduplicação explícita)
  const { data: existing } = await supabase
    .from("bank_transactions")
    .select("external_id")
    .eq("tenant_id", session.tenant.id)
    .in("external_id", allExternalIds)

  const existingSet = new Set((existing ?? []).map((r) => r.external_id))

  const novos = candidatos.filter((c) => !existingSet.has(c.externalId))
  const skipped = candidatos.length - novos.length

  if (novos.length === 0) {
    return NextResponse.json({
      imported: 0,
      skipped,
      total: candidatos.length,
      errors: parseResult.errors,
      format: parseResult.format,
      rowsScanned: parseResult.rowsScanned,
    })
  }

  // Construir registos para inserir
  const toInsert = novos.map(({ externalId, tx }) => ({
    tenant_id: session.tenant.id,
    account_id: accountId ?? "manual",
    account_name: accountName,
    bank_name: bankName,
    iban,
    external_id: externalId,
    date: tx.date,
    amount: tx.amount,
    currency: "EUR",
    description: tx.description,
    type: tx.amount < 0 ? "debit" : "credit",
  }))

  // Inserir em lotes de 50
  let imported = 0
  const insertErrors: string[] = [...parseResult.errors]

  const BATCH = 50
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH)
    const { error } = await supabase.from("bank_transactions").insert(batch)

    if (error) {
      insertErrors.push(`Erro ao guardar lote ${Math.floor(i / BATCH) + 1}: ${error.message}`)
    } else {
      imported += batch.length
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    total: candidatos.length,
    errors: insertErrors,
    format: parseResult.format,
    rowsScanned: parseResult.rowsScanned,
  })
}
