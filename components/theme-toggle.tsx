"use client"

import { useTheme } from "next-themes"
import { Leaf, Monitor, Moon, Sparkles, Sun } from "lucide-react"
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
      <DropdownMenuRadioGroup
        value={theme ?? "finmed-light"}
        onValueChange={(v) => setTheme(v)}
      >
        <DropdownMenuRadioItem value="finmed-light" className="cursor-pointer">
          <Leaf className="mr-2 h-4 w-4 text-emerald-600" />
          Bosque (claro)
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="finmed-dark" className="cursor-pointer">
          <Leaf className="mr-2 h-4 w-4 text-emerald-400" />
          Bosque (escuro)
        </DropdownMenuRadioItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Padrão
        </DropdownMenuLabel>
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
      </DropdownMenuRadioGroup>
    </>
  )
}
