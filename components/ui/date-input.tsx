"use client"

import { CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Input de data com o icone de calendario (lucide) a' direita, no lugar do
 * indicador nativo (que fica escondido). Clicar abre o seletor (showPicker).
 */
export function DateInput({
  value,
  onChange,
  className,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
  ariaLabel?: string
}) {
  return (
    <span className="relative inline-flex items-center">
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.currentTarget.showPicker?.()}
        aria-label={ariaLabel}
        className={cn(
          "h-7 w-[120px] border-0 bg-transparent shadow-none pl-1 pr-6 text-sm focus-visible:outline-none focus-visible:ring-0",
          "[&::-webkit-calendar-picker-indicator]:hidden",
          className,
        )}
      />
      <CalendarDays className="pointer-events-none absolute right-1 h-4 w-4 text-muted-foreground" />
    </span>
  )
}
