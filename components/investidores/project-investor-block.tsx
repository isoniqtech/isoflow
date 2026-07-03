"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Users, Plus, Trash2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/utils/portugal"

type LinkedInvestidor = {
  investidor_id: string
  nome: string
  email: string
  percentagem: number
  valor_estimado: number | null
}

type AvailableInvestidor = {
  id: string
  nome: string
  email: string
  capital_disponivel: number
}

type InputMode = "pct" | "eur"

export function ProjectInvestorBlock({
  projectId,
  budget,
  linked,
  available,
  canEdit,
}: {
  projectId: string
  budget: number | null
  linked: LinkedInvestidor[]
  available: AvailableInvestidor[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [selectedId, setSelectedId] = useState("")
  const [mode, setMode] = useState<InputMode>("pct")
  const [inputValue, setInputValue] = useState("")
  const [loading, setLoading] = useState(false)

  const totalPct = linked.reduce((s, l) => s + l.percentagem, 0)
  const unlinkedAvailable = available.filter(
    (a) => !linked.find((l) => l.investidor_id === a.id),
  )
  const selectedInvestidor = unlinkedAvailable.find((a) => a.id === selectedId)

  // Derived values from input
  const { pct, eurValue, validationError } = useMemo(() => {
    const raw = parseFloat(inputValue)
    if (isNaN(raw) || raw <= 0) return { pct: null, eurValue: null, validationError: null }

    let pct: number | null = null
    let eurValue: number | null = null
    let validationError: string | null = null

    if (mode === "pct") {
      pct = raw
      if (budget !== null) {
        eurValue = (budget * raw) / 100
      } else if (selectedInvestidor && selectedInvestidor.capital_disponivel > 0) {
        // Sem orçamento não é possível converter % em € para validar contra capital
        validationError = "Defina um orçamento no projeto para validar contra o capital do investidor."
        return { pct, eurValue: null, validationError }
      }
    } else {
      eurValue = raw
      pct = budget !== null ? (raw / budget) * 100 : null
    }

    if (pct !== null && pct > 100) {
      validationError = "Percentagem não pode exceder 100%"
    }

    if (
      selectedInvestidor &&
      selectedInvestidor.capital_disponivel > 0 &&
      eurValue !== null &&
      eurValue > selectedInvestidor.capital_disponivel
    ) {
      validationError = `Excede o capital disponível do investidor (${formatCurrency(selectedInvestidor.capital_disponivel)})`
    }

    return { pct, eurValue, validationError }
  }, [inputValue, mode, budget, selectedInvestidor])

  function reset() {
    setAdding(false)
    setSelectedId("")
    setInputValue("")
    setMode("pct")
  }

  async function linkInvestidor() {
    if (!selectedId || pct === null) return
    if (validationError) {
      toast.error(validationError)
      return
    }
    const finalPct = Math.round(pct * 100) / 100
    if (finalPct <= 0 || finalPct > 100) {
      toast.error("Percentagem inválida (0.01 - 100)")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/projetos/${projectId}/investidores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investidor_id: selectedId, percentagem: finalPct }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erro")
      toast.success("Investidor associado")
      reset()
      startTransition(() => router.refresh())
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function unlinkInvestidor(investidorId: string) {
    if (!confirm("Remover investidor deste projeto?")) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/projetos/${projectId}/investidores?investidor_id=${investidorId}`,
        { method: "DELETE" },
      )
      if (!res.ok) throw new Error("Erro ao remover")
      toast.success("Investidor removido")
      startTransition(() => router.refresh())
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const canSave = selectedId && pct !== null && pct > 0 && !validationError

  return (
    <div className="rounded-lg border bg-background p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Investidores</span>
          {totalPct > 0 && (
            <Badge variant="secondary" className="text-xs">
              {totalPct.toFixed(0)}% alocado
            </Badge>
          )}
        </div>
        {canEdit && unlinkedAvailable.length > 0 && !adding && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Adicionar
          </Button>
        )}
      </div>

      {linked.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">Nenhum investidor associado.</p>
      )}

      {linked.map((l) => (
        <div key={l.investidor_id} className="flex items-center justify-between text-sm">
          <div>
            <span className="font-medium">{l.nome}</span>
            <span className="ml-2 text-muted-foreground">{l.percentagem}%</span>
            {l.valor_estimado !== null && (
              <span className="ml-2 text-muted-foreground text-xs">
                ({formatCurrency(l.valor_estimado)})
              </span>
            )}
          </div>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              disabled={loading}
              onClick={() => unlinkInvestidor(l.investidor_id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}

      {adding && (
        <div className="space-y-2 pt-1">
          {/* Linha 1: investidor + toggle modo + input + botões */}
          <div className="flex items-center gap-2">
            <Select value={selectedId} onValueChange={(v) => { setSelectedId(v); setInputValue("") }}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Selecionar investidor" />
              </SelectTrigger>
              <SelectContent>
                {unlinkedAvailable.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome}
                    {a.capital_disponivel > 0 && (
                      <span className="ml-1 text-muted-foreground">
                        ({formatCurrency(a.capital_disponivel)})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Toggle % / € */}
            <div className="flex rounded-md border overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => { setMode("pct"); setInputValue("") }}
                className={`h-8 px-2.5 text-xs font-medium transition-colors ${
                  mode === "pct"
                    ? "bg-foreground text-background"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                %
              </button>
              <button
                type="button"
                onClick={() => { setMode("eur"); setInputValue("") }}
                disabled={budget === null}
                title={budget === null ? "Defina um orçamento no projeto para usar valor em €" : undefined}
                className={`h-8 px-2.5 text-xs font-medium transition-colors border-l ${
                  mode === "eur"
                    ? "bg-foreground text-background"
                    : "bg-background text-muted-foreground hover:bg-muted"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                €
              </button>
            </div>

            <Input
              className="h-8 text-xs w-24"
              placeholder={mode === "pct" ? "0.00 %" : "0,00 €"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              type="number"
              min="0.01"
              step={mode === "pct" ? "0.01" : "1000"}
            />

            <Button
              size="sm"
              className="h-8 text-xs shrink-0"
              disabled={loading || !canSave}
              onClick={linkInvestidor}
            >
              Guardar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs shrink-0"
              onClick={reset}
            >
              Cancelar
            </Button>
          </div>

          {/* Referência: capital disponível do investidor selecionado */}
          {selectedInvestidor && selectedInvestidor.capital_disponivel > 0 && (
            <p className="pl-1 text-xs text-muted-foreground">
              Capital disponivel: <span className="font-medium tabular-nums">{formatCurrency(selectedInvestidor.capital_disponivel)}</span>
            </p>
          )}

          {/* Linha 2: preview do valor calculado / erro */}
          {selectedId && inputValue && (
            <div className="pl-1">
              {validationError ? (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {validationError}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {mode === "pct" && pct !== null && (
                    <>
                      {pct.toFixed(2)}% do orçamento
                      {eurValue !== null && <> = {formatCurrency(eurValue)}</>}
                    </>
                  )}
                  {mode === "eur" && eurValue !== null && pct !== null && (
                    <>{formatCurrency(eurValue)} = {pct.toFixed(2)}% do orçamento</>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
