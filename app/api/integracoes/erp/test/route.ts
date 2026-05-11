import { z } from "zod"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { sendToN8N } from "@/lib/webhooks/n8n"

export const runtime = "nodejs"

const bodySchema = z.object({
  url: z.string().url(),
  secret: z.string().min(1, "Secret obrigatório para teste"),
})

/**
 * Testa o webhook n8n enviando um payload de ping. Não persiste nada.
 * O recetor n8n deve devolver 2xx para considerarmos sucesso.
 */
export async function POST(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "integracoes", "edit")) {
    return jsonError("Forbidden", 403)
  }

  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = bodySchema.parse(await req.json())
  } catch (e) {
    return jsonError("Payload inválido", 400, (e as z.ZodError).flatten())
  }

  const result = await sendToN8N(
    {
      tenant_id: ctx.tenantId,
      invoice: {
        id: "00000000-0000-0000-0000-000000000000",
        supplier_name: "ISOFlow Test Supplier",
        supplier_nif: "999999990",
        invoice_number: "TEST-0001",
        invoice_date: new Date().toISOString().slice(0, 10),
        due_date: null,
        subtotal: 10,
        vat_rate: 23,
        vat_amount: 2.3,
        total: 12.3,
        currency: "EUR",
        description: "Teste de integração n8n",
        category: "outro",
        source: "test",
        file_path: null,
      },
      file_url: null,
      metadata: {
        sent_by: ctx.email,
        sender_email: ctx.email,
        project_id: null,
      },
    },
    { url: parsed.url, secret: parsed.secret },
  )

  if (!result.ok) {
    return Response.json({
      ok: false,
      status: result.status ?? null,
      error: result.error ?? "Sem resposta",
    })
  }
  return Response.json({ ok: true, status: result.status ?? 200 })
}
