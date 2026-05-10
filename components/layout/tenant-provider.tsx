"use client"

import { createContext } from "react"
import type { CurrentSession } from "@/lib/queries/current-session"

export const TenantContext = createContext<CurrentSession | null>(null)

export function TenantProvider({
  value,
  children,
}: {
  value: CurrentSession
  children: React.ReactNode
}) {
  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  )
}
