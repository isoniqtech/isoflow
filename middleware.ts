import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

const AUTH_ROUTES = new Set([
  "/login",
  "/register",
  "/forgot-password",
])

export async function middleware(request: NextRequest) {
  const { response, supabase, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/cron") ||
    pathname === "/api/efatura/sync" ||
    pathname.startsWith("/auth/callback") ||
    pathname === "/reset-password"
  ) {
    return response
  }

  const isAuthRoute = AUTH_ROUTES.has(pathname)

  if (!user) {
    if (isAuthRoute) return response
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile && pathname !== "/onboarding") {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("onboarding_completed")
      .eq("id", profile.tenant_id)
      .maybeSingle()

    if (tenant && !tenant.onboarding_completed) {
      const url = request.nextUrl.clone()
      url.pathname = "/onboarding"
      return NextResponse.redirect(url)
    }
  }

  if (pathname.startsWith("/admin")) {
    const superAdminId = process.env.SUPER_ADMIN_USER_ID
    if (!superAdminId || user.id !== superAdminId) {
      const url = request.nextUrl.clone()
      url.pathname = "/"
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
