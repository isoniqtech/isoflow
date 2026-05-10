import type { LucideIcon } from "lucide-react"
import {
  FileText,
  FolderKanban,
  GitMerge,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  Settings,
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
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
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
    label: "Conciliação",
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
    href: "/configuracoes",
    label: "Configurações",
    icon: Settings,
    requires: [{ resource: "configuracoes", action: "view_all" }],
  },
]
