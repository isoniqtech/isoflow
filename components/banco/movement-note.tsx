"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, StickyNote } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/**
 * Nota de texto livre por movimento bancario.
 * Botao discreto que abre um popover com textarea + guardar.
 * Persiste em PATCH /api/banco/transactions/[id]; a nota flui depois
 * para o documento TOConline (via fatura conciliada) para o contabilista.
 */
export function MovementNote({
  id,
  initialNotes,
  align = "end",
}: {
  id: string
  initialNotes: string | null
  align?: "start" | "center" | "end"
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(initialNotes ?? "")
  const [saved, setSaved] = useState<string | null>(initialNotes)
  const [busy, setBusy] = useState(false)

  const hasNote = Boolean(saved && saved.trim().length > 0)

  async function save() {
    const trimmed = value.trim()
    setBusy(true)
    const res = await fetch(`/api/banco/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: trimmed.length > 0 ? trimmed : null }),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      toast.error("Falha ao guardar nota", {
        description: errBody.error ?? `HTTP ${res.status}`,
      })
      setBusy(false)
      return
    }
    setSaved(trimmed.length > 0 ? trimmed : null)
    setBusy(false)
    setOpen(false)
    toast.success(trimmed.length > 0 ? "Nota guardada" : "Nota removida")
    router.refresh()
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setValue(saved ?? "")
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 shrink-0",
            hasNote
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
          title={hasNote ? "Editar nota" : "Adicionar nota"}
          aria-label={hasNote ? "Editar nota do movimento" : "Adicionar nota ao movimento"}
        >
          <StickyNote className={cn("h-4 w-4", hasNote && "fill-primary/20")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-80 space-y-2">
        <div className="space-y-1">
          <p className="text-sm font-medium">Nota do movimento</p>
          <p className="text-xs text-muted-foreground">
            Visível ao contabilista no TOConline quando a fatura ligada é sincronizada.
          </p>
        </div>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ex: pagamento parcial, adiantamento, taxa bancária..."
          rows={4}
          maxLength={2000}
          className="text-sm resize-none"
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Guardar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
