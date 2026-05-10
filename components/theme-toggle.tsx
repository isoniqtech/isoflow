"use client"

import { useTheme } from "next-themes"
import { Monitor, Moon, Sparkles, Sun } from "lucide-react"
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"

export function ThemeRadioGroup() {
  const { theme, setTheme } = useTheme()

  return (
    <>
      <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Padrão
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={theme ?? "system"}
        onValueChange={(v) => setTheme(v)}
      >
        <DropdownMenuRadioItem value="light" className="cursor-pointer">
          <Sun className="mr-2 h-4 w-4" />
          Claro
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark" className="cursor-pointer">
          <Moon className="mr-2 h-4 w-4" />
          Escuro
        </DropdownMenuRadioItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Studio
        </DropdownMenuLabel>
        <DropdownMenuRadioItem value="studio" className="cursor-pointer">
          <Sparkles className="mr-2 h-4 w-4" />
          Studio (claro)
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="studio-dark" className="cursor-pointer">
          <Sparkles className="mr-2 h-4 w-4" />
          Studio (escuro)
        </DropdownMenuRadioItem>
        <DropdownMenuSeparator />
        <DropdownMenuRadioItem value="system" className="cursor-pointer">
          <Monitor className="mr-2 h-4 w-4" />
          Sistema
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </>
  )
}
