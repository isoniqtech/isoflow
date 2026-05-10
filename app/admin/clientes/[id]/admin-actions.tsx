"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { TenantPlan, TenantStatus } from "@/types"

export function AdminClientActions({
  tenantId,
  plan,
  status,
}: {
  tenantId: string
  plan: TenantPlan
  status: TenantStatus
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [planValue, setPlanValue] = useState<TenantPlan>(plan)
  const [statusValue, setStatusValue] = useState<TenantStatus>(status)
  const [creditsAmount, setCreditsAmount] = useState("")
  const [creditsDescription, setCreditsDescription] = useState("")

  async function patchTenant(payload: Partial<{ plan: TenantPlan; status: TenantStatus }>) {
    setBusy(true)
    const res = await fetch(`/api/admin/clientes/${tenantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      toast.error("Falha", { description: errBody.error ?? `HTTP ${res.status}` })
      setBusy(false)
      return false
    }
    setBusy(false)
    router.refresh()
    return true
  }

  async function handleSavePlan() {
    if (await patchTenant({ plan: planValue })) {
      toast.success(`Plano alterado para ${planValue}`)
    }
  }

  async function handleSaveStatus() {
    if (await patchTenant({ status: statusValue })) {
      toast.success(`Estado alterado para ${statusValue}`)
    }
  }

  async function handleAddCredits() {
    const amount = parseInt(creditsAmount, 10)
    if (isNaN(amount) || amount === 0) {
      toast.error("Indica um valor válido (positivo ou negativo)")
      return
    }
    if (!creditsDescription.trim()) {
      toast.error("Indica a razão (descrição)")
      return
    }
    setBusy(true)
    const res = await fetch(`/api/admin/clientes/${tenantId}/credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        type: amount > 0 ? "bonus" : "refund",
        description: creditsDescription,
      }),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      toast.error("Falha ao ajustar créditos", {
        description: errBody.error ?? `HTTP ${res.status}`,
      })
      setBusy(false)
      return
    }
    const { data } = await res.json()
    toast.success(`Créditos ajustados (${amount > 0 ? "+" : ""}${amount}). Novo saldo: ${data.balance}`)
    setCreditsAmount("")
    setCreditsDescription("")
    setBusy(false)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Ações de admin</CardTitle>
        <CardDescription>
          Alterações administrativas. Ficam registadas em audit_logs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Plano</Label>
          <div className="flex gap-2">
            <Select value={planValue} onValueChange={(v) => setPlanValue(v as TenantPlan)}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleSavePlan}
              disabled={busy || planValue === plan}
              size="sm"
            >
              Guardar
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Estado</Label>
          <div className="flex gap-2">
            <Select value={statusValue} onValueChange={(v) => setStatusValue(v as TenantStatus)}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="suspended">Suspenso</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            {statusValue !== status &&
            (statusValue === "suspended" || statusValue === "cancelled") ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" disabled={busy}>
                    Aplicar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {statusValue === "suspended" ? "Suspender" : "Cancelar"} cliente?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      O cliente perde acesso à app até reactivares.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleSaveStatus}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Confirmar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button
                onClick={handleSaveStatus}
                disabled={busy || statusValue === status}
                size="sm"
              >
                Guardar
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2 border-t pt-5">
          <Label>Ajustar créditos</Label>
          <Input
            type="number"
            value={creditsAmount}
            onChange={(e) => setCreditsAmount(e.target.value)}
            placeholder="Ex: 500 (positivo) ou -100 (subtrair)"
          />
          <Input
            value={creditsDescription}
            onChange={(e) => setCreditsDescription(e.target.value)}
            placeholder="Razão (ex: bónus de acolhimento)"
          />
          <Button
            onClick={handleAddCredits}
            disabled={busy || !creditsAmount || !creditsDescription.trim()}
            size="sm"
            className="w-full"
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aplicar ajuste
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
