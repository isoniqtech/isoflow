import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { TicketForm } from "@/components/suporte/ticket-form"
import { getCurrentSession } from "@/lib/queries/current-session"
import { hasPermission } from "@/lib/utils/permissions"

export default async function NovoTicketPage() {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!hasPermission(session.role, "suporte", "create")) {
    redirect("/suporte")
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/suporte"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar a suporte
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Novo ticket</h1>
        <p className="text-muted-foreground text-sm">
          Descreve o teu pedido. A equipa ISONIQ TECH responde via chat aqui na
          plataforma.
        </p>
      </div>

      <div className="rounded-lg border bg-background p-6">
        <TicketForm creditsBalance={session.tenant.credits_balance} />
      </div>
    </div>
  )
}
