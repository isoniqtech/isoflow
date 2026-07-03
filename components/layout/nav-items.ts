import type { LucideIcon } from "lucide-react"
import {
  FileText,
  FolderKanban,
  GitMerge,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  UserCircle,
  Users,
} from "lucide-react"
import type { Action, Resource } from "@/lib/utils/permissions"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Quando definido, o item só aparece se o user tiver pelo menos uma destas permissions. */
  requires?: Array<{ resource: Resource; action: Action }>
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    requires: [{ resource: "dashboard", action: "view_all" }],
  },
  {
    href: "/faturas",
    label: "Faturas",
    icon: FileText,
    requires: [
      { resource: "faturas", action: "view_own" },
      { resource: "faturas", action: "view_all" },
    ],
  },
  {
    href: "/projetos",
    label: "Projetos",
    icon: FolderKanban,
    requires: [
      { resource: "projetos", action: "view_own" },
      { resource: "projetos", action: "view_all" },
    ],
  },
  {
    href: "/conciliacao",
    label: "Conciliação Bancária",
    icon: GitMerge,
    requires: [{ resource: "conciliacao", action: "view_all" }],
  },
  {
    href: "/banco",
    label: "Banco",
    icon: Landmark,
    requires: [{ resource: "banco", action: "view_all" }],
  },
  {
    href: "/suporte",
    label: "Suporte",
    icon: LifeBuoy,
    requires: [{ resource: "suporte", action: "create" }],
  },
  {
    href: "/investidores",
    label: "Investidores",
    icon: Users,
    requires: [{ resource: "investidores", action: "view_all" }],
  },
  {
    href: "/perfil",
    label: "Perfil",
    icon: UserCircle,
    requires: [{ resource: "investidor_perfil", action: "view_all" }],
  },
]
