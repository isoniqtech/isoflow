import { getApiContext, jsonError } from "@/lib/api/auth"
import { hasPermission } from "@/lib/utils/permissions"
import { listProjects } from "@/lib/queries/projects"
import { buildCsv, csvResponse, safeFilename } from "@/lib/export/csv"
import type { ProjectStatus, ProjectType } from "@/types"

const VALID_STATUS: Array<ProjectStatus | "all"> = [
  "all",
  "active",
  "completed",
  "paused",
  "cancelled",
]
const VALID_TYPE: Array<ProjectType | "all"> = [
  "all",
  "obra",
  "projeto",
  "departamento",
  "cliente",
  "outro",
]

const TYPE_LABELS: Record<ProjectType, string> = {
  obra: "Obra",
  projeto: "Projeto",
  departamento: "Departamento",
  cliente: "Cliente",
  outro: "Outro",
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Ativo",
  completed: "Concluido",
  paused: "Pausado",
  cancelled: "Cancelado",
}

export async function GET(req: Request) {
  const ctx = await getApiContext()
  if (!ctx) return jsonError("Unauthorized", 401)
  if (!hasPermission(ctx.role, "relatorios", "view_all")) {
    return jsonError("Forbidden", 403)
  }

  const { searchParams } = new URL(req.url)
  const status = (VALID_STATUS as string[]).includes(searchParams.get("status") ?? "")
    ? (searchParams.get("status") as ProjectStatus | "all")
    : "all"
  const type = (VALID_TYPE as string[]).includes(searchParams.get("type") ?? "")
    ? (searchParams.get("type") as ProjectType | "all")
    : "all"

  const projects = await listProjects(ctx.tenantId, {
    role: ctx.role,
    userId: ctx.userId,
    filter: { status, type },
  })

  const csv = buildCsv(projects, [
    { header: "Nome", value: (r) => r.name },
    { header: "Codigo", value: (r) => r.code },
    { header: "Tipo", value: (r) => TYPE_LABELS[r.type] },
    { header: "Estado", value: (r) => STATUS_LABELS[r.status] },
    { header: "Cliente", value: (r) => r.client_name },
    { header: "Inicio", value: (r) => r.start_date },
    { header: "Fim", value: (r) => r.end_date },
    {
      header: "Orcamento",
      value: (r) => (r.budget !== null ? r.budget.toFixed(2) : ""),
    },
    {
      header: "Gasto",
      value: (r) => r.total_spent.toFixed(2),
    },
    {
      header: "Restante",
      value: (r) =>
        r.budget !== null ? (r.budget - r.total_spent).toFixed(2) : "",
    },
    { header: "Faturas", value: (r) => r.invoice_count },
  ])

  return csvResponse(csv, safeFilename("projetos", "csv"))
}
