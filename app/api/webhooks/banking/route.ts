import { createHmac, timingSafeEqual } from "crypto"

export const runtime = "nodejs"

/**
 * Webhook do Tink — chamado quando há atualização de transações ou refresh
 * concluído. Eventos relevantes:
 *  - account-transactions:modified
 *  - refresh:finished
 *
 * O Tink envia um JWT-like signature no header `X-Tink-Signature`. Validamos
 * com HMAC SHA256 usando TINK_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  const secret = process.env.TINK_WEBHOOK_SECRET
  if (!secret) {
    console.error("TINK_WEBHOOK_SECRET não configurado")
    return new Response("Server not configured", { status: 500 })
  }

  const signature = req.headers.get("x-tink-signature")
  const body = await req.text()

  if (!signature) {
    return new Response("Missing signature", { status: 401 })
  }

  // Tink usa HMAC-SHA256 com formato `t=<timestamp>,v1=<hmac>`
  const parts = Object.fromEntries(
    signature.split(",").map((kv) => {
      const idx = kv.indexOf("=")
      return [kv.slice(0, idx), kv.slice(idx + 1)]
    }),
  )
  const timestamp = parts["t"]
  const sigHex = parts["v1"]
  if (!timestamp || !sigHex) {
    return new Response("Bad signature format", { status: 401 })
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex")
  const expectedBuf = Buffer.from(expected, "hex")
  const sigBuf = Buffer.from(sigHex, "hex")
  if (
    expectedBuf.length !== sigBuf.length ||
    !timingSafeEqual(expectedBuf, sigBuf)
  ) {
    return new Response("Invalid signature", { status: 401 })
  }

  // Parse + log. Sync real é despoletado pelo dashboard (ou por cron).
  let payload: unknown = null
  try {
    payload = JSON.parse(body)
  } catch {
    // ignore — não-JSON, ainda assim devolver 200 para evitar retries.
  }

  const event =
    payload && typeof payload === "object" && "event" in payload
      ? String((payload as Record<string, unknown>).event)
      : "unknown"

  console.info("Tink webhook received:", event)

  // TODO: quando event === "refresh:finished" e payload tem credentialsId,
  // mapear para um tenant via tenant_integrations.config e marcar
  // last_sync_at + acionar sync.

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}
