import { type NextRequest } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { getInvestidorDetail } from "@/lib/queries/investidores"
import { InvestorReport } from "@/lib/pdf/investor-report"

export const runtime = "nodejs"

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Nao autenticado", 401)

  const data = await getInvestidorDetail(params.id, ctx.tenantId)
  if (!data) return jsonError("Nao encontrado", 404)

  const generatedAt = new Date().toISOString()

  const buffer = await renderToBuffer(
    InvestorReport({ data, generatedAt }),
  )

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="investidor-${params.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
