import { redirect } from "next/navigation"
import { getCurrentSession } from "@/lib/queries/current-session"
import { hasPermission } from "@/lib/utils/permissions"
import { InvestorProfileForm } from "@/components/investidores/investor-profile-form"
import type { InvestidorEstado, TipoNegocio } from "@/types"

export const metadata = { title: "Perfil - ISOFlow" }

type UntypedClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>
        [key: string]: unknown
      }
      [key: string]: unknown
    }
  }
}

export default async function PerfilPage() {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!hasPermission(session.role, "investidor_perfil", "view_all")) redirect("/dashboard")

  const { createClient } = await import("@/lib/supabase/server")
  const supabase = createClient()
  const raw = supabase as unknown as UntypedClient

  const { data: inv } = await raw
    .from("investidores")
    .select("id, nome, email, estado, capital_disponivel, tipo_negocio, notas")
    .eq("user_id", session.user.id)
    .maybeSingle()

  if (!inv) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
        <p className="text-muted-foreground text-sm">
          Perfil de investidor nao encontrado. Contacte o administrador.
        </p>
      </div>
    )
  }

  // Capital alocado em projetos (soma dos valor_alocado)
  type LinkRow = { valor_alocado: number | null }
  const { data: links } = await supabase
    .from("projeto_investidores" as "project_members")
    .select("valor_alocado")
    .eq("investidor_id" as "project_id", inv.id as string)

  const capitalAlocado = ((links ?? []) as unknown as LinkRow[]).reduce(
    (s, l) => s + Number(l.valor_alocado ?? 0),
    0,
  )

  const profile = {
    id: inv.id as string,
    nome: inv.nome as string,
    email: inv.email as string,
    estado: (inv.estado as InvestidorEstado) ?? "pronto_para_investir",
    capital_disponivel: Number(inv.capital_disponivel ?? 0),
    capital_alocado: capitalAlocado,
    tipo_negocio: (inv.tipo_negocio as TipoNegocio[]) ?? [],
    notas: (inv.notas as string | null) ?? null,
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
