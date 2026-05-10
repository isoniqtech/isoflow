"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Coins,
  LayoutDashboard,
  LifeBuoy,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"

const ADMIN_NAV = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/tickets", label: "Tickets", icon: LifeBuoy },
  { href: "/admin/receita", label: "Receita", icon: Coins },
]

export function AdminMobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden border-b bg-background overflow-x-auto">
      <ul className="flex items-center gap-1 px-2 py-2 min-w-max">
        {ADMIN_NAV.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
