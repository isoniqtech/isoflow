import { redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { getCurrentSession } from "@/lib/queries/current-session"
import { hasPermission } from "@/lib/utils/permissions"
import { ProjectForm } from "@/components/projetos/project-form"

export default async function NovoProjetoPage() {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!hasPermission(session.role, "projetos", "create")) {
    redirect("/projetos")
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/projetos"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Novo projeto</h1>
        <p className="text-muted-foreground text-sm">
          Cria uma obra, projeto, departamento ou cliente para organizar as
          faturas.
        </p>
      </div>

      <div className="rounded-lg border bg-background p-6">
        <ProjectForm mode="create" />
      </div>
    </div>
  )
}
