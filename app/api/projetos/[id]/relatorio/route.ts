import { renderToBuffer } from "@react-pdf/renderer"
import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { getProjectDetail } from "@/lib/queries/project-detail"
import { createClient } from "@/lib/supabase/server"
import { ProjectReport } from "@/lib/pdf/project-report"

export const runtime = "nodejs"

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "relatorios", "view_all")) {
    return jsonError("Forbidden", 403)
  }

  const data = await getProjectDetail(params.id, ctx.tenantId)
  if (!data) return jsonError("Not found", 404)

  const supabase = createClient()
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, app_name, primary_color")
    .eq("id", ctx.tenantId)
    .maybeSingle()

  const generatedAt = new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date())

  const buffer = await renderToBuffer(
    ProjectReport({
      data,
      brand: {
        appName: tenant?.app_name ?? "ISOFlow",
        tenantName: tenant?.name ?? "ISONIQ TECH",
        primaryColor: tenant?.primary_color ?? "#2563EB",
      },
      generatedAt,
    }),
  )

  const safeName = data.project.name.replace(/[^\w\s-]/g, "").trim() || "projeto"
  const filename = `relatorio-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
