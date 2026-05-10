import Link from "next/link"
import { redirect } from "next/navigation"
import { Building2, ChevronRight, CreditCard, Plug, Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { CompanyForm } from "./company-form"
import { getCurrentSession } from "@/lib/queries/current-session"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/utils/permissions"

export default async function ConfiguracoesPage() {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!hasPermission(session.role, "configuracoes", "view_all")) {
    redirect("/")
  }

  const supabase = createClient()
  const { data: tenantFull } = await supabase
    .from("tenants")
    .select("phone, address")
    .eq("id", session.tenant.id)
    .maybeSingle()

  const canManageBilling = hasPermission(session.role, "billing", "view_all")
  const canManageIntegrations = hasPermission(
    session.role,
    "integracoes",
    "view_all",
  )
  const canManageUsers = hasPermission(session.role, "utilizadores", "view_all")

  const links = [
    canManageUsers && {
      href: "/configuracoes/utilizadores",
      label: "Utilizadores",
      description: "Convidar membros, gerir roles e permissões",
      icon: Users,
    },
    canManageIntegrations && {
      href: "/configuracoes/integracoes",
      label: "Integrações",
      description: "ERPs, banco (Salt Edge), WhatsApp e email inbound",
      icon: Plug,
    },
    canManageBilling && {
      href: "/configuracoes/plano",
      label: "Plano e créditos",
      description: "Subscrição, consumo e packs avulso",
      icon: CreditCard,
    },
  ].filter(Boolean) as Array<{
    href: string
    label: string
    description: string
    icon: typeof Users
  }>

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm">
          Personaliza a tua empresa e gere o acesso da equipa.
        </p>
      </div>

      <section className="space-y-3">
        <header className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Dados da empresa
          </h2>
        </header>
        <Card>
          <CardContent className="p-6">
            <CompanyForm
              tenant={{
                id: session.tenant.id,
                name: session.tenant.name,
                nif: session.tenant.nif,
                primary_color: session.tenant.primary_color,
                app_name: session.tenant.app_name,
                phone: tenantFull?.phone ?? null,
                address: tenantFull?.address ?? null,
              }}
            />
          </CardContent>
        </Card>
      </section>

      {links.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Mais configurações
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="group">
                <Card className="transition-shadow group-hover:shadow-md">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <link.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{link.label}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {link.description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
