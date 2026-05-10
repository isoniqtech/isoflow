"use client"

import { useTenant } from "@/hooks/use-tenant"
import {
  hasPermission as checkPermission,
  type Action,
  type Resource,
} from "@/lib/utils/permissions"

export function usePermissions() {
  const { role } = useTenant()
  return {
    role,
    hasPermission: (resource: Resource, action: Action) =>
      checkPermission(role, resource, action),
  }
}
