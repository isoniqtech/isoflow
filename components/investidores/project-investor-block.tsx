"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Users, Plus, Trash2 } from "lucide-react"
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
}

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
  const [percentagem, setPercentagem] = useState("")
  const [loading, setLoading] = useState(false)

  const totalPct = linked.reduce((s, l) => s + l.percentagem, 0)
  const unlinkedAvailable = available.filter(
    (a) => !linked.find((l) => l.investidor_id === a.id),
  )

  async function linkInvestidor() {
    if (!selectedId || !percentagem) return
    const pct = parseFloat(percentagem)
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      toast.error("Percentagem invalida (1-100)")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/projetos/${projectId}/investidores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investidor_id: selectedId, percentagem: pct }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erro")
      toast.success("Investidor associado")
      setAdding(false)
      setSelectedId("")
      setPercentagem("")
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
        <div
          key={l.investidor_id}
          className="flex items-center justify-between text-sm"
        >
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
        <div className="flex items-center gap-2 pt-1">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Selecionar investidor" />
            </SelectTrigger>
            <SelectContent>
              {unlinkedAvailable.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="h-8 text-xs w-20"
            placeholder="% "
            value={percentagem}
            onChange={(e) => setPercentagem(e.target.value)}
            type="number"
            min="0.01"
            max="100"
            step="0.01"
          />
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={loading || !selectedId || !percentagem}
            onClick={linkInvestidor}
          >
            Guardar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setAdding(false)
              setSelectedId("")
              setPercentagem("")
            }}
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  )
}
