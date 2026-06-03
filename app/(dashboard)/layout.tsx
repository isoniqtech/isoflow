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
      <Sidebar className="hidden md:flex" />
      <div className="flex flex-col h-dvh md:pl-60">
        <Header />
        <main className="flex-1 overflow-auto bg-muted/30">{children}</main>
      </div>
    </TenantProvider>
  )
}
