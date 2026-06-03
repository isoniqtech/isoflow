"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Landmark, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { BankAccountConfig } from "@/app/api/integracoes/banco/route"

const PT_BANKS = [
  "Caixa Geral de Depósitos",
  "Millennium BCP",
  "Banco BPI",
  "Santander",
  "NovoBanco",
  "Caixa Agrícola",
  "ING",
  "Montepio",
  "Activobank",
  "Revolut",
  "Wise",
  "Outro",
]

const ACCOUNT_TYPES = [
  "Conta Ordem",
  "Conta Poupança",
  "Conta Empresarial",
  "Conta Corrente",
  "Cartão de Crédito",
  "Outro",
]

function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

function EmptyRow() {
  return (
    <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground italic">
      <Landmark className="h-4 w-4 shrink-0" />
      Sem contas configuradas
    </div>
  )
}

export function BankAccountsCard({
  initial,
  canEdit,
}: {
  initial: BankAccountConfig[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [accounts, setAccounts] = useState<BankAccountConfig[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // New account form state
  const [newBank, setNewBank] = useState("")
  const [newBankCustom, setNewBankCustom] = useState("")
  const [newIban, setNewIban] = useState("")
  const [newType, setNewType] = useState("Conta Ordem")
  const [newLabel, setNewLabel] = useState("")

  const effectiveBank = newBank === "Outro" ? newBankCustom : newBank

  function addAccount() {
    if (!effectiveBank.trim()) {
      toast.error("Seleciona ou introduz o banco")
      return
    }
    if (!newIban.trim()) {
      toast.error("IBAN obrigatório")
      return
    }
    const label = newLabel.trim() || `${effectiveBank} ${newType}`
    const next = [
      ...accounts,
      {
        id: randomId(),
        bank_name: effectiveBank.trim(),
        iban: newIban.trim().replace(/\s/g, "").toUpperCase(),
        account_type: newType,
        label,
      },
    ]
    setAccounts(next)
    setNewBank("")
    setNewBankCustom("")
    setNewIban("")
    setNewType("Conta Ordem")
    setNewLabel("")
    setShowForm(false)
  }

  function removeAccount(id: string) {
    setAccounts((prev) => prev.filter((a) => a.id !== id))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/integracoes/banco", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accounts }),
      })
      const body = await res.json()
      if (res.ok && body.ok) {
        toast.success("Contas bancárias guardadas")
        router.refresh()
      } else {
        toast.error("Erro ao guardar", { description: body.error ?? `HTTP ${res.status}` })
      }
    } catch (e) {
      toast.error("Erro de ligação", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  const hasPendingChanges =
    JSON.stringify(accounts) !== JSON.stringify(initial)

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Landmark className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">Banco</p>
              <p className="text-xs text-muted-foreground">
                Configura os teus bancos e contas para importar extratos.
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0",
              accounts.length > 0
                ? "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40"
                : "",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full mr-1.5",
                accounts.length > 0 ? "bg-emerald-500" : "bg-muted-foreground",
              )}
            />
            {accounts.length > 0
              ? `${accounts.length} conta${accounts.length !== 1 ? "s" : ""}`
              : "Sem contas"}
          </Badge>
        </div>

        {/* Account list */}
        {accounts.length === 0 ? (
          <EmptyRow />
        ) : (
          <ul className="space-y-1.5">
            {accounts.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.bank_name} · {a.account_type}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">{a.iban}</p>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeAccount(a.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Add account form */}
        {canEdit && showForm && (
          <div className="space-y-3 pt-2 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Banco</Label>
                <Select value={newBank} onValueChange={setNewBank}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleciona o banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {PT_BANKS.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newBank === "Outro" && (
                  <Input
                    placeholder="Nome do banco"
                    value={newBankCustom}
                    onChange={(e) => setNewBankCustom(e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Tipo de conta</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>IBAN</Label>
              <Input
                placeholder="PT50 0000 0000 0000 0000 0000 0"
                value={newIban}
                onChange={(e) => setNewIban(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                Etiqueta
                <span className="text-xs text-muted-foreground ml-2">(opcional)</span>
              </Label>
              <Input
                placeholder={effectiveBank ? `${effectiveBank} ${newType}` : "Ex: CA Empresa Principal"}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowForm(false)
                  setNewBank("")
                  setNewBankCustom("")
                  setNewIban("")
                  setNewLabel("")
                }}
              >
                Cancelar
              </Button>
              <Button size="sm" onClick={addAccount}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        {canEdit && !showForm && (
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar conta
            </Button>
            {hasPendingChanges && (
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
