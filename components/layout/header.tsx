"use client"

import { MobileNav } from "./mobile-nav"
import { CommandPalette, CommandTrigger } from "./command-palette"

export function Header() {
  return (
    <header className="h-14 border-b bg-background flex items-center px-4 gap-3 shrink-0">
      <MobileNav />
      <CommandTrigger />
      <div className="flex-1" />
      <CommandPalette />
    </header>
  )
}
