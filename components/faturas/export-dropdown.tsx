"use client"

import { Download, FileSpreadsheet, FileText, Menu, Sheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ExportDropdown({
  exportUrl,
  compact = false,
}: {
  exportUrl: string
  /** compact = botao hamburger (icone) em vez do botao "Exportar". */
  compact?: boolean
}) {
  function buildUrl(format: "csv" | "xlsx" | "pdf") {
    const sep = exportUrl.includes("?") ? "&" : "?"
    return `${exportUrl}${sep}format=${format}`
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <Button variant="outline" size="icon" className="h-9 w-9 bg-card border-border/60 shadow-sm" aria-label="Mais ações">
            <Menu className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {compact && (
          <>
            <DropdownMenuLabel className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Download className="h-3.5 w-3.5" />
              Exportar
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <a href={buildUrl("csv")} download>
            <Sheet className="mr-2 h-4 w-4" />
            CSV
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={buildUrl("xlsx")} download>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel (.xlsx)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={buildUrl("pdf")} download>
            <FileText className="mr-2 h-4 w-4" />
            PDF
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
