"use client"

import { Download, FileSpreadsheet, FileText, Sheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ExportDropdown({ exportUrl }: { exportUrl: string }) {
  function buildUrl(format: "csv" | "xlsx" | "pdf") {
    const url = new URL(exportUrl, window.location.origin)
    url.searchParams.set("format", format)
    return url.toString()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
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
