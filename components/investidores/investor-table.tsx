"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  MoreHorizontal,
  Mail,
  Pencil,
  Trash2,
  UserCheck,
} from "lucide-react"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils/portugal"
import type { InvestidorListItem } from "@/lib/queries/investidores"
import type { InvestidorEstado, TipoNegocio } from "@/types"

const ESTADO_LABELS: Record<InvestidorEstado, string> = {
  pronto_para_investir: "Pronto",
  em_investimento: "Em investimento",
  nao_disponivel: "Nao disponivel",
}

const ESTADO_CLASSES: Record<InvestidorEstado, string> = {
  pronto_para_investir:
    "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40",
  em_investimento:
    "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-900/40",
  nao_disponivel:
    "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
}

const TIPO_LABELS: Record<TipoNegocio, string> = {
  terreno: "Terreno",
  casa: "Casa",
  edificio: "Edificio",
}

export function InvestorTable({
  rows,
  canEdit,
  canDelete,
}: {
  rows: InvestidorListItem[]
  canEdit: boolean
  canDelete: boolean
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function sendInvite(id: string) {
    setLoadingId(id)
    try {
      const res = await fetch(`/api/investidores/${id}/invite`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Erro")
      toast.success("Convite enviado")
      startTransition(() => router.refresh())
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setLoadingId(null)
    }
  }

  async function deleteInvestidor(id: string) {
    if (!confirm("Confirmas que queres eliminar este investidor?")) return
    setLoadingId(id)
    try {
      const res = await fetch(`/api/investidores/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Erro ao eliminar")
      toast.success("Investidor eliminado")
      startTransition(() => router.refresh())
    } catch (e: unknown) {
      toast.error((e as Error).message)
    } finally {
      setLoadingId(null)
    }
  }

  if (!rows.length) {
    return (
      <div className="rounded-lg border bg-background p-8 text-center">
        <p className="text-sm text-muted-foreground">Nenhum investidor registado.</p>
        {canEdit && (
          <Link href="/configuracoes/utilizadores">
            <Button className="mt-4" size="sm" variant="outline">
              Convidar investidor em Configurações
            </Button>
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-background overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b">
          <tr className="text-left">
            <th className="px-4 py-3 font-medium text-muted-foreground">Nome</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Email</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Estado</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Tipo negocio</th>
            <th className="px-4 py-3 font-medium text-muted-foreground text-right">Capital</th>
            <th className="px-4 py-3 font-medium text-muted-foreground text-right">Projetos</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Acesso</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
              <td className="px-4 py-3 font-medium">
                <Link href={`/investidores/${row.id}`} className="hover:underline">
                  {row.nome}
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{row.email}</td>
              <td className="px-4 py-3">
                <Badge variant="outline" className={ESTADO_CLASSES[row.estado]}>
                  {ESTADO_LABELS[row.estado]}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {row.tipo_negocio.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">
                      {TIPO_LABELS[t]}
                    </Badge>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatCurrency(row.capital_disponivel)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {row.projetos_count}
              </td>
              <td className="px-4 py-3">
                {row.user_id ? (
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40">
                    <UserCheck className="h-3 w-3 mr-1" />
                    Ativo
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    Sem acesso
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3">
                {(canEdit || canDelete) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={loadingId === row.id}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/investidores/${row.id}`}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Ver detalhe
                        </Link>
                      </DropdownMenuItem>
                      {canEdit && !row.user_id && (
                        <DropdownMenuItem onClick={() => sendInvite(row.id)}>
                          <Mail className="h-4 w-4 mr-2" />
                          Enviar convite
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => deleteInvestidor(row.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
