import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { getCurrentSession } from "@/lib/queries/current-session"
import { isSuperAdmin } from "@/lib/supabase/admin"
import { AdminSidebar } from "@/components/layout/admin-sidebar"
import { AdminMobileNav } from "@/components/layout/admin-mobile-nav"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  if (!isSuperAdmin(session.user.id)) redirect("/dashboard")

  return (
    <div className="min-h-screen flex bg-muted/30">
      <AdminSidebar className="hidden md:flex" />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-background flex items-center px-4 gap-3 shrink-0">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Voltar à app</span>
            <span className="sm:hidden">App</span>
          </Link>
          <div className="flex-1" />
          <span className="text-xs font-medium text-muted-foreground truncate max-w-[60%] sm:max-w-none">
            <span className="hidden sm:inline">Modo Super-admin · </span>
            {session.user.email}
          </span>
        </header>
        <AdminMobileNav />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
