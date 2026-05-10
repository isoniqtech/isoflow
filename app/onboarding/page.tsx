import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OnboardingWizard } from "./onboarding-wizard"

export default async function OnboardingPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile) {
    redirect("/login")
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, nif, phone, address, onboarding_completed")
    .eq("id", profile.tenant_id)
    .maybeSingle()

  if (!tenant) {
    redirect("/login")
  }

  if (tenant.onboarding_completed) {
    redirect("/")
  }

  return (
    <OnboardingWizard
      tenant={{
        id: tenant.id,
        name: tenant.name,
        nif: tenant.nif,
        phone: tenant.phone,
        address: tenant.address,
      }}
    />
  )
}
