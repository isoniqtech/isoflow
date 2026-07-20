"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Coins,
  LayoutDashboard,
  LifeBuoy,
  ShieldCheck,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"

const ADMIN_NAV = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/tickets", label: "Tickets", icon: LifeBuoy },
  { href: "/admin/receita", label: "Receita", icon: Coins },
]

export function AdminSidebar({
  className,
  newTickets = 0,
}: {
  className?: string
  newTickets?: number
}) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "h-screen w-60 border-r bg-background flex flex-col sticky top-0",
        className,
      )}
    >
      <Link
        href="/admin"
        className="flex items-center gap-2 px-4 h-14 border-b shrink-0"
      >
        <div className="h-7 w-7 rounded bg-foreground flex items-center justify-center">
          <ShieldCheck className="h-4 w-4 text-background" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight">ISOFlow Admin</p>
          <p className="text-[10px] text-muted-foreground">ISONIQ TECH</p>
        </div>
      </Link>

      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {ADMIN_NAV.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            const badge = item.href === "/admin/tickets" ? newTickets : 0
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                  {badge > 0 && (
                    <span
                      className={cn(
                        "ml-auto inline-flex min-w-5 h-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                        active
                          ? "bg-background text-foreground"
                          : "bg-destructive text-destructive-foreground",
                      )}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
