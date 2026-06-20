"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { UserRole } from "@/types"

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  accountant: "Contabilista",
  member: "Membro",
}

export function UserRoleSelect({
  userId,
  currentRole,
}: {
  userId: string
  currentRole: UserRole
}) {
  const [role, setRole] = useState(currentRole)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleChange(newRole: string) {
    if (newRole === role) return
    setLoading(true)
    const res = await fetch(`/api/utilizadores/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    })
    if (res.ok) {
      setRole(newRole as UserRole)
      toast.success("Role atualizado")
      router.refresh()
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? "Erro ao atualizar role")
    }
    setLoading(false)
  }

  return (
    <Select value={role} onValueChange={handleChange} disabled={loading}>
      <SelectTrigger className="h-7 text-xs w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="accountant">Contabilista</SelectItem>
        <SelectItem value="member">Membro</SelectItem>
      </SelectContent>
    </Select>
  )
}
