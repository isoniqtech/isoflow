import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { getCurrentSession } from "@/lib/queries/current-session"
import { getProjectDetail } from "@/lib/queries/project-detail"
import { hasPermission } from "@/lib/utils/permissions"
import { ProjectForm } from "@/components/projetos/project-form"

export default async function EditProjectPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!hasPermission(session.role, "projetos", "edit")) {
    redirect(`/projetos/${params.id}`)
  }

  const data = await getProjectDetail(params.id, session.tenant.id)
  if (!data) notFound()

  const { project } = data

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href={`/projetos/${project.id}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar ao projeto
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Editar projeto</h1>
        <p className="text-muted-foreground text-sm">
          Atualiza os dados do projeto.
        </p>
      </div>

      <div className="rounded-lg border bg-background p-6">
        <ProjectForm
          mode="edit"
          projectId={project.id}
          defaults={{
            name: project.name,
            code: project.code ?? "",
            type: project.type,
            status: project.status,
            description: project.description ?? "",
            budget: project.budget !== null ? String(project.budget) : "",
            budget_alert_threshold: String(project.budget_alert_threshold),
            start_date: project.start_date ?? "",
            end_date: project.end_date ?? "",
            color: project.color,
            client_name: project.client_name ?? "",
            location: project.location ?? "",
            notes: project.notes ?? "",
            aliases: project.name_aliases,
          }}
        />
      </div>
    </div>
  )
}
