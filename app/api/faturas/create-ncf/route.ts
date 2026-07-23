import { z } from "zod"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { sendCreditNoteToERP } from "@/lib/toconline/send-ncf"

// Envio de notas de credito (NCF) ao ERP. Caminho ISOLADO - nao toca no create-fc.
// Trata os dois modos (direto/n8n) via sendCreditNoteToERP.

const schema = z.object({
  invoice_ids: z.array(z.string().uuid()).min(1).max(50),
})

export async function POST(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "faturas", "edit")) {
    return jsonError("Forbidden", 403)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError("Invalid JSON", 400)
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return jsonError("Validation error", 400, parsed.error.flatten())
  }

  let created = 0
  let skipped = 0
  const errors: Array<{ id: string; error: string }> = []

  for (const id of parsed.data.invoice_ids) {
    const result = await sendCreditNoteToERP(ctx.tenantId, id)
    if (result.ok) {
      if (result.skipped || result.alreadyExisted) skipped += 1
      else created += 1
    } else {
      errors.push({ id, error: result.error ?? "Falha desconhecida" })
    }
  }

  if (created === 0 && skipped === 0 && errors.length > 0) {
    return jsonError("Nao foi possivel enviar a nota de credito", 502, errors[0].error)
  }

  return Response.json({ queued: created, skipped, errors })
}
