import { redirect } from "next/navigation"
import Link from "next/link"
import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InvestorStats } from "@/components/investidores/investor-stats"
import { InvestorTable } from "@/components/investidores/investor-table"
import { getCurrentSession } from "@/lib/queries/current-session"
import { listInvestidores, getInvestidorStats } from "@/lib/queries/investidores"
import { hasPermission } from "@/lib/utils/permissions"

export const metadata = { title: "Investidores - ISOFlow" }

export default async function InvestidoresPage() {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!hasPermission(session.role, "investidores", "view_all")) redirect("/dashboard")

  const [list, stats] = await Promise.all([
    listInvestidores(session.tenant.id),
    getInvestidorStats(session.tenant.id),
  ])

  const canEdit = hasPermission(session.role, "investidores", "edit")
  const canDelete = hasPermission(session.role, "investidores", "delete")

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Investidores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestao de investidores e capitais alocados a projetos
          </p>
        </div>
        {canEdit && (
          <Link href="/configuracoes/utilizadores">
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Convidar investidor
            </Button>
          </Link>
        )}
      </div>

      <InvestorStats stats={stats} />

      <InvestorTable
        rows={list}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  )
}
