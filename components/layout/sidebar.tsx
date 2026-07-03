"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useTenant } from "@/hooks/use-tenant"
import { usePermissions } from "@/hooks/use-permissions"
import { NAV_ITEMS, type NavItem } from "./nav-items"
export function Sidebar({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 w-60 border-r bg-background flex flex-col",
        className,
      )}
    >
      <SidebarBrand />
      <SidebarNav className="flex-1 px-3 py-4 overflow-y-auto" />
    </aside>
  )
}

function SidebarBrand() {
  const { tenant } = useTenant()
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 px-4 h-14 border-b shrink-0"
    >
      {tenant.logo_url ? (
        <Image
          src={tenant.logo_url}
          alt={tenant.app_name}
          width={28}
          height={28}
          className="h-7 w-7 rounded object-contain"
          unoptimized
        />
      ) : (
        <div
          className="h-7 w-7 rounded flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: tenant.primary_color }}
        >
          {tenant.app_name.charAt(0).toUpperCase()}
        </div>
      )}
      <span className="font-semibold tracking-tight truncate">
        {tenant.app_name}
      </span>
    </Link>
  )
}

export function SidebarNav({
  className,
  onNavigate,
}: {
  className?: string
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const { hasPermission } = usePermissions()

  const visible = NAV_ITEMS.filter((item) => {
    if (!item.requires?.length) return true
    return item.requires.some((p) => hasPermission(p.resource, p.action))
  })

  return (
    <nav className={className}>
      <ul className="space-y-1">
        {visible.map((item) => (
          <li key={item.href}>
            <NavLink
              item={item}
              active={isActive(pathname, item.href)}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ul>
    </nav>
  )
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  )
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
