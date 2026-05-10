/**
 * Builder de CSV escapado para Excel/Numbers.
 * Usa BOM UTF-8 para garantir que o Excel apanha acentos.
 *
 * Cada coluna é definida com label e accessor (transforma a row no valor da célula).
 */
export type CsvColumn<T> = {
  header: string
  value: (row: T) => string | number | null | undefined
}

const BOM = "﻿"

function escape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines: string[] = []
  lines.push(columns.map((c) => escape(c.header)).join(","))
  for (const row of rows) {
    const cells = columns.map((c) => {
      const v = c.value(row)
      if (v === null || v === undefined) return ""
      return escape(String(v))
    })
    lines.push(cells.join(","))
  }
  return BOM + lines.join("\r\n") + "\r\n"
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}

export function safeFilename(input: string, extension: string): string {
  const base = input.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase()
  const date = new Date().toISOString().slice(0, 10)
  return `${base || "export"}-${date}.${extension}`
}
