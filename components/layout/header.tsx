"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Coins,
  LogOut,
  Palette,
  Settings,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react"
import { toast } from "sonner"
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
import { Button } from "@/components/ui/button"
import { useTenant } from "@/hooks/use-tenant"
import { usePermissions } from "@/hooks/use-permissions"
import { createClient } from "@/lib/supabase/client"
import { MobileNav } from "./mobile-nav"
import { ThemeRadioGroup } from "@/components/theme-toggle"
import { CommandPalette, CommandTrigger } from "./command-palette"

export function Header() {
  const { user, tenant } = useTenant()
  const { hasPermission } = usePermissions()
  const router = useRouter()
  const initials = getInitials(user.name || user.email)

  async function handleSignOut() {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error("Não foi possível terminar sessão", {
        description: error.message,
      })
      return
    }
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="h-14 border-b bg-background flex items-center px-4 gap-3 shrink-0">
      <MobileNav />
      <CommandTrigger />
      <div className="flex-1" />
      <CommandPalette />
      <Link
        href={hasPermission("billing", "view_all") ? "/configuracoes/plano" : "#"}
        className="hidden sm:flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted/50 transition-colors"
        aria-label="Créditos disponíveis"
      >
        <Coins className="h-3.5 w-3.5" />
        <span className="tabular-nums">
          {tenant.credits_balance.toLocaleString("pt-PT")}
        </span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="rounded-full p-0 h-9 w-9">
            <Avatar className="h-9 w-9">
              {user.avatar_url && (
                <AvatarImage src={user.avatar_url} alt={user.name} />
              )}
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user.name}</span>
              <span className="text-xs text-muted-foreground truncate">
                {user.email}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {hasPermission("configuracoes", "view_all") && (
            <DropdownMenuItem asChild>
              <Link href="/configuracoes" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href="/configuracoes" className="cursor-pointer">
              <UserIcon className="mr-2 h-4 w-4" />
              Conta
            </Link>
          </DropdownMenuItem>
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
            Terminar sessão
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s.charAt(0))
    .join("")
    .toUpperCase()
}
