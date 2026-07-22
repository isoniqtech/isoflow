"use client"

/**
 * Categoria de gasto (conta do TOConline) usada ao enviar a fatura para o ERP.
 * A IA escolhe uma por defeito quando a fatura entra; aqui a pessoa pode
 * trocá-la antes de enviar. Grava logo ao escolher.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Categoria = { code: string; name: string; tax_code: string | null }

export function ExpenseCategorySelect({
  invoiceId,
  currentCode,
  decidedByAi,
  canEdit,
}: {
  invoiceId: string
  currentCode: string | null
  decidedByAi: boolean
  canEdit: boolean
}) {
  const router = useRouter()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [valor, setValor] = useState<string>(currentCode ?? "")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelado = false
    fetch("/api/integracoes/toconline/expense-categories")
      .then((r) => r.json())
      .then((body) => {
        if (!cancelado) setCategorias(body.categorias ?? [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [])

  async function guardar(code: string) {
    const anterior = valor
    setValor(code)
    setSaving(true)
    try {
      const res = await fetch(`/api/faturas/${invoiceId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expense_category_code: code }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setValor(anterior)
        toast.error("Falha ao guardar categoria", { description: body.error ?? `HTTP ${res.status}` })
        return
      }
      toast.success("Categoria atualizada")
      router.refresh()
    } catch (e) {
      setValor(anterior)
      toast.error("Erro de rede", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  const escolhida = categorias.find((c) => c.code === valor)

  return (
    <Card>
      <CardContent className="p-5 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label htmlFor="expense-cat">Categoria de gasto (ERP)</Label>
          {decidedByAi && valor && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              sugerida automaticamente
            </span>
          )}
        </div>

        {canEdit ? (
          <div className="flex items-center gap-2">
            <Select value={valor} onValueChange={guardar} disabled={loading || saving || categorias.length === 0}>
              <SelectTrigger id="expense-cat" className="w-full">
                <SelectValue
                  placeholder={
                    loading
                      ? "A carregar categorias..."
                      : categorias.length === 0
                        ? "Sem categorias disponíveis"
                        : "Escolhe a categoria"
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {categorias.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} - {c.name}
                    {c.tax_code ? ` (IVA ${c.tax_code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
          </div>
        ) : (
          <p className="text-sm">
            {escolhida ? `${escolhida.code} - ${escolhida.name}` : valor || "Por definir"}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Conta usada na fatura de compra criada no TOConline. Podes trocá-la antes de enviar para o ERP.
        </p>
      </CardContent>
    </Card>
  )
}
