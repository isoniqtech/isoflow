import { redirect } from "next/navigation"
import { getCurrentSession } from "@/lib/queries/current-session"
import Link from "next/link"
import { LayoutDashboard, Shield } from "lucide-react"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession()
  if (!session || !session.user.is_super_admin) redirect("/dashboard")

  return (
    <div className="min-h-dvh flex flex-col bg-muted/30">
      <header className="h-14 border-b bg-background flex items-center px-6 gap-4 shrink-0">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Shield className="h-4 w-4 text-primary" />
          ISOFlow Admin
        </div>
        <nav className="flex items-center gap-1 ml-4">
          <Link
            href="/admin"
            className="text-sm px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
          >
            Clientes
          </Link>
        </nav>
        <div className="ml-auto">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
            Voltar ao dashboard
          </Link>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
