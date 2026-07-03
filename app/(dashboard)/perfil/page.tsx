import { redirect } from "next/navigation"
import { getCurrentSession } from "@/lib/queries/current-session"
import { hasPermission } from "@/lib/utils/permissions"
import { getInvestidorByUserId } from "@/lib/queries/investidores"
import { InvestorProfileForm } from "@/components/investidores/investor-profile-form"

export const metadata = { title: "Perfil - ISOFlow" }

export default async function PerfilPage() {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!hasPermission(session.role, "investidor_perfil", "view_all")) redirect("/dashboard")

  const inv = await getInvestidorByUserId(session.user.id)

  if (!inv) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
        <p className="text-muted-foreground text-sm">
          Perfil de investidor nao encontrado. Contacte o administrador.
        </p>
      </div>
    )
  }

  // Capital alocado = soma dos valores estimados por projeto (budget × percentagem / 100)
  const capitalAlocado = inv.projetos.reduce(
    (s, p) => s + (p.valor_estimado ?? 0),
    0,
  )

  const profile = {
    id: inv.id,
    nome: inv.nome,
    email: inv.email,
    estado: inv.estado,
    capital_disponivel: Number(inv.capital_disponivel ?? 0),
    capital_alocado: capitalAlocado,
    tipo_negocio: inv.tipo_negocio ?? [],
    notas: inv.notas ?? null,
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Os teus dados de investidor e preferencias
        </p>
      </div>
      <InvestorProfileForm profile={profile} />
    </div>
  )
}
