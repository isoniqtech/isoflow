"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import {
  LifeBuoy,
  LogOut,
  Palette,
  Settings,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useTenant } from "@/hooks/use-tenant"
import { usePermissions } from "@/hooks/use-permissions"
import { NAV_ITEMS, type NavItem } from "./nav-items"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeRadioGroup } from "@/components/theme-toggle"
import { TenantSwitcher } from "@/components/layout/tenant-switcher"
import { createClient } from "@/lib/supabase/client"

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
      <SidebarFooter />
    </aside>
  )
}

function SidebarBrand() {
  const { tenant, availableTenants } = useTenant()

  const currentSummary = availableTenants.find((t) => t.id === tenant.id) ?? {
    id: tenant.id,
    name: tenant.name,
    logo_url: tenant.logo_url,
    primary_color: tenant.primary_color,
    app_name: tenant.app_name,
    role: "owner" as const,
    is_primary: true,
  }

  return (
    <div className="flex items-center gap-2 px-4 h-14 border-b shrink-0">
      <Link href="/dashboard" className="flex items-center gap-2 flex-1 min-w-0">
        {tenant.logo_url ? (
          <Image
            src={tenant.logo_url}
            alt={tenant.app_name}
            width={28}
            height={28}
            className="h-7 w-7 rounded object-contain shrink-0"
            unoptimized
          />
        ) : (
          <div
            className="h-7 w-7 rounded flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: tenant.primary_color }}
          >
            {tenant.app_name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <span className="font-display font-semibold tracking-tight truncate text-sm leading-tight">
            {tenant.app_name}
          </span>
          {availableTenants.length > 1 && (
            <TenantSwitcher current={currentSummary} available={availableTenants} />
          )}
        </div>
      </Link>
    </div>
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
          ? "bg-gradient-to-r from-primary/12 to-primary/5 text-primary font-medium border-l-2 border-primary pl-2.5"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  )
}

export function SidebarFooter({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useTenant()
  const { hasPermission } = usePermissions()
  const pathname = usePathname()
  const router = useRouter()
  const initials = getInitials(user.name || user.email)

  async function handleSignOut() {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error("Nao foi possivel terminar sessao", { description: error.message })
      return
    }
    router.push("/login")
    router.refresh()
  }

  const configActive = isActive(pathname, "/configuracoes")
  const suporteActive = isActive(pathname, "/suporte")

  return (
    <div className="border-t p-3 space-y-1">
      {hasPermission("suporte", "create") && (
        <Link
          href="/suporte"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            suporteActive
              ? "bg-gradient-to-r from-primary/12 to-primary/5 text-primary font-medium border-l-2 border-primary pl-2.5"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <span className="h-6 w-6 flex items-center justify-center shrink-0">
            <LifeBuoy className="h-4 w-4" />
          </span>
          Suporte
        </Link>
      )}
      {hasPermission("configuracoes", "view_all") && (
        <Link
          href="/configuracoes"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            configActive
              ? "bg-gradient-to-r from-primary/12 to-primary/5 text-primary font-medium border-l-2 border-primary pl-2.5"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <span className="h-6 w-6 flex items-center justify-center shrink-0">
            <Settings className="h-4 w-4" />
          </span>
          Configurações
        </Link>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <Avatar className="h-6 w-6 shrink-0">
              {user.avatar_url && (
                <AvatarImage src={user.avatar_url} alt={user.name} />
              )}
              <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 text-left">
              <p className="truncate text-sm font-medium leading-none">{user.name || user.email}</p>
              {user.name && (
                <p className="truncate text-[11px] text-muted-foreground/60 mt-0.5">{user.email}</p>
              )}
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user.name}</span>
              <span className="text-xs text-muted-foreground truncate">{user.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <Palette className="mr-2 h-4 w-4" />
              Tema
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <ThemeRadioGroup />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {user.is_super_admin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin" className="cursor-pointer">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Admin (ISONIQ TECH)
                </Link>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSignOut}
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Terminar sessao
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s.charAt(0))
    .join("")
    .toUpperCase()
}
