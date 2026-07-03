"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useTenant } from "@/hooks/use-tenant"
import { SidebarNav, SidebarFooter } from "./sidebar"

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const { tenant } = useTenant()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 flex flex-col">
        <SheetHeader className="px-4 h-14 border-b shrink-0 flex flex-row items-center">
          <SheetTitle asChild>
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2"
            >
              <div
                className="h-7 w-7 rounded flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: tenant.primary_color }}
              >
                {tenant.app_name.charAt(0).toUpperCase()}
              </div>
              <span>{tenant.app_name}</span>
            </Link>
          </SheetTitle>
        </SheetHeader>
        <SidebarNav
          className="flex-1 px-3 py-4 overflow-y-auto"
          onNavigate={() => setOpen(false)}
        />
        <SidebarFooter onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
