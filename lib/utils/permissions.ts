import type { UserRole } from "@/types"

export type Resource =
  | "dashboard"
  | "faturas"
  | "projetos"
  | "banco"
  | "conciliacao"
  | "relatorios"
  | "utilizadores"
  | "configuracoes"
  | "integracoes"
  | "billing"
  | "suporte"
  | "investidores"
  | "investidor_perfil"

export type Action = "view_all" | "view_own" | "create" | "edit" | "delete"

const PERMISSIONS: Record<UserRole, Partial<Record<Resource, Action[]>>> = {
  owner: {
    dashboard: ["view_all"],
    faturas: ["view_all", "view_own", "create", "edit", "delete"],
    projetos: ["view_all", "view_own", "create", "edit", "delete"],
    banco: ["view_all"],
    conciliacao: ["view_all", "create", "edit"],
    relatorios: ["view_all"],
    utilizadores: ["view_all", "create", "edit", "delete"],
    configuracoes: ["view_all", "edit"],
    integracoes: ["view_all", "create", "edit", "delete"],
    billing: ["view_all", "edit"],
    suporte: ["view_all", "create"],
    investidores: ["view_all", "create", "edit", "delete"],
  },
  admin: {
    dashboard: ["view_all"],
    faturas: ["view_all", "view_own", "create", "edit", "delete"],
    projetos: ["view_all", "view_own", "create", "edit"],
    banco: ["view_all"],
    conciliacao: ["view_all", "create", "edit"],
    relatorios: ["view_all"],
    utilizadores: ["view_all", "create", "edit", "delete"],
    configuracoes: ["view_all", "edit"],
    suporte: ["view_all", "create"],
    investidores: ["view_all", "create", "edit", "delete"],
  },
  accountant: {
    dashboard: ["view_all"],
    faturas: ["view_all", "view_own", "create"],
    projetos: ["view_all", "view_own"],
    banco: ["view_all"],
    conciliacao: ["view_all", "create", "edit"],
    relatorios: ["view_all"],
    suporte: ["view_all", "create"],
    investidores: ["view_all"],
  },
  member: {
    dashboard: ["view_all"],
    faturas: ["view_own", "create"],
    projetos: ["view_own"],
    suporte: ["create"],
  },
  investidor: {
    faturas: ["view_own"],
    projetos: ["view_own"],
    relatorios: ["view_all"],
    investidor_perfil: ["view_all", "edit"],
  },
}

export function hasPermission(
  role: UserRole,
  resource: Resource,
  action: Action,
): boolean {
  return PERMISSIONS[role]?.[resource]?.includes(action) ?? false
}
