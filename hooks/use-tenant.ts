"use client"

import { useContext } from "react"
import { TenantContext } from "@/components/layout/tenant-provider"

export function useTenant() {
  const ctx = useContext(TenantContext)
  if (!ctx) {
    throw new Error("useTenant must be used inside a TenantProvider")
  }
  return ctx
}
