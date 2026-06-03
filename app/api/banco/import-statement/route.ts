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
  const accountId = formData.get("account_id") as string | null  // ID da conta configurada

  if (!file) return NextResponse.json({ error: "Ficheiro obrigatório" }, { status: 400 })

  const fileName = file.name.toLowerCase()
  const buffer = await file.arrayBuffer()

  // Parse conforme o tipo de ficheiro
  let parseResult
  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    parseResult = await parseExcel(buffer)
  } else if (fileName.endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(buffer)
    parseResult = await parseCsv(text)
  } else if (fileName.endsWith(".pdf")) {
    parseResult = await parsePdf(buffer)
  } else {
    // Tenta como CSV se não reconhecer extensão
    const text = new TextDecoder("utf-8").decode(buffer)
    parseResult = await parseCsv(text)
  }

  if (parseResult.transactions.length === 0) {
    return NextResponse.json({
      imported: 0,
      skipped: 0,
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

  // Construir registos a inserir com external_id para deduplicação
  const toInsert = parseResult.transactions.map((tx) => {
    const externalId = makeExternalId(session.tenant.id, tx.date, tx.amount, tx.description)
    return {
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
      external_status: "BOOKED",  // importados = definitivos
    }
  })

  // Inserir com upsert — conflito em external_id → ignorar (deduplicação)
  let imported = 0
  let skipped = 0
  const insertErrors: string[] = [...parseResult.errors]

  // Processar em lotes de 50 para não exceder limites
  const BATCH = 50
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH)
    const { data, error } = await supabase
      .from("bank_transactions")
      .upsert(batch, {
        onConflict: "tenant_id,external_id",
        ignoreDuplicates: true,
      })
      .select("id")

    if (error) {
      insertErrors.push(`Erro ao guardar lote ${Math.floor(i / BATCH) + 1}: ${error.message}`)
    } else {
      // Supabase com ignoreDuplicates não diz quantos foram ignorados,
      // mas os inseridos são os que voltam no data
      imported += (data ?? []).length
    }
  }

  skipped = toInsert.length - imported

  return NextResponse.json({
    imported,
    skipped,
    total: toInsert.length,
    errors: insertErrors,
    format: parseResult.format,
    rowsScanned: parseResult.rowsScanned,
  })
}
