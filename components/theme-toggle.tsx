"use client"

import { useTheme } from "next-themes"
import { Monitor, Moon, Sun } from "lucide-react"
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"

export function ThemeRadioGroup() {
  const { theme, setTheme } = useTheme()

  return (
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
      <DropdownMenuRadioItem value="system" className="cursor-pointer">
        <Monitor className="mr-2 h-4 w-4" />
        Sistema
      </DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  )
}
