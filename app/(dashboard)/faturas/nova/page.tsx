import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { getCurrentSession } from "@/lib/queries/current-session"
import { listProjectOptions } from "@/lib/queries/invoices"
import { hasPermission } from "@/lib/utils/permissions"
import { InvoiceForm } from "@/components/faturas/invoice-form"

export default async function NovaFaturaPage({
  searchParams,
}: {
  searchParams: { project?: string }
}) {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!hasPermission(session.role, "faturas", "create")) {
    redirect("/faturas")
  }

  const projects = await listProjectOptions(session.tenant.id)

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/faturas"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar a faturas
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Nova fatura</h1>
        <p className="text-muted-foreground text-sm">
          Adiciona manualmente uma fatura. A extração automática via IA será
          ativada quando configurares a chave Anthropic.
        </p>
      </div>

      <div className="rounded-lg border bg-background p-6">
        <InvoiceForm projects={projects} defaultProjectId={searchParams.project} />
      </div>
    </div>
  )
}
