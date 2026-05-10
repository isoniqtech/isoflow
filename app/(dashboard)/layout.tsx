import { redirect } from "next/navigation"
import { getCurrentSession } from "@/lib/queries/current-session"
import { TenantProvider } from "@/components/layout/tenant-provider"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!session.tenant.onboarding_completed) redirect("/onboarding")

  return (
    <TenantProvider value={session}>
      <div className="min-h-screen flex">
        <Sidebar className="hidden md:flex" />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 overflow-auto bg-muted/30">{children}</main>
        </div>
      </div>
    </TenantProvider>
  )
}
