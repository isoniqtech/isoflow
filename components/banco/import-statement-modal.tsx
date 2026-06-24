"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FileSpreadsheet, FileText, Loader2, Upload, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { BankAccountConfig } from "@/app/api/integracoes/banco/route"

const ACCEPTED = ".xlsx,.xls,.csv,.pdf"

type ImportResult = {
  imported: number
  skipped: number
  total: number
  errors: string[]
  format: string
  rowsScanned: number
}

export function ImportStatementModal({
  accounts,
}: {
  accounts: BankAccountConfig[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<string>(accounts[0]?.id ?? "")
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  function reset() {
    setSelectedFile(null)
    setResult(null)
    setLoading(false)
  }

  function handleFile(file: File) {
    setResult(null)
    setSelectedFile(file)
  }

  function fileIcon(name: string) {
    if (name.endsWith(".pdf")) return <FileText className="h-5 w-5 text-red-500" />
    return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
  }

  async function handleImport() {
    if (!selectedFile) return
    setLoading(true)
    setResult(null)

    try {
      const fd = new FormData()
      fd.append("file", selectedFile)
      if (selectedAccount) fd.append("account_id", selectedAccount)

      const res = await fetch("/api/banco/import-statement", { method: "POST", body: fd })
      const data: ImportResult = await res.json()

      if (!res.ok) {
        toast.error("Erro ao importar", { description: (data as { error?: string }).error ?? `HTTP ${res.status}` })
        return
      }

      setResult(data)

      if (data.imported > 0) {
        toast.success(`${data.imported} movimento${data.imported !== 1 ? "s" : ""} importado${data.imported !== 1 ? "s" : ""}`, {
          description: data.skipped > 0 ? `${data.skipped} já existiam — ignorados` : undefined,
        })
        router.refresh()
      } else if (data.skipped > 0) {
        toast.info("Nenhum movimento novo", {
          description: `${data.skipped} movimento${data.skipped !== 1 ? "s" : ""} já existia${data.skipped !== 1 ? "m" : ""} no sistema.`,
        })
      } else {
        toast.warning("Nenhum movimento encontrado", {
          description: "Verifica se o formato do ficheiro é suportado.",
        })
      }
    } catch (e) {
      toast.error("Erro de rede", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Importar Extrato
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar extrato bancário</DialogTitle>
          <DialogDescription>
            Suporta ficheiros Excel (.xlsx), CSV e PDF exportados pelo teu banco.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Conta */}
          {accounts.length > 0 && (
            <div className="space-y-1.5">
              <Label>Conta bancária</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleciona a conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label}
                      {a.iban && (
                        <span className="ml-2 text-muted-foreground font-mono text-xs">
                          ···{a.iban.slice(-8)}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Drop zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
            )}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const f = e.dataTransfer.files[0]
              if (f) handleFile(f)
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-2">
                {fileIcon(selectedFile.name)}
                <span className="text-sm font-medium">{selectedFile.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setResult(null) }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Arrasta o ficheiro ou clica para selecionar
                </p>
                <p className="text-xs text-muted-foreground">.xlsx · .csv · .pdf</p>
              </div>
            )}
          </div>

          {/* Resultado */}
          {result && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Movimentos importados</span>
                <span className="font-medium text-emerald-700 dark:text-emerald-400">{result.imported}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Já existiam (ignorados)</span>
                <span className="font-medium">{result.skipped}</span>
              </div>
              {result.errors.length > 0 && (
                <div className="pt-1 border-t text-xs text-muted-foreground space-y-0.5">
                  {result.errors.slice(0, 3).map((e, i) => (
                    <p key={i}>{e}</p>
                  ))}
                  {result.errors.length > 3 && (
                    <p>…e mais {result.errors.length - 3} aviso(s)</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Ações */}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {result ? "Fechar" : "Cancelar"}
            </Button>
            {!result && (
              <Button
                onClick={handleImport}
                disabled={!selectedFile || loading}
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A importar…</>
                ) : (
                  <><Upload className="mr-2 h-4 w-4" />Importar</>
                )}
              </Button>
            )}
            {result && result.imported > 0 && (
              <Button onClick={() => { reset(); setOpen(false) }}>
                Concluído
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
