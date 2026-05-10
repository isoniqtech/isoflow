import Link from "next/link"
import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginForm } from "./login-form"

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Acede à tua conta ISOFlow</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Suspense>
          <LoginForm />
        </Suspense>
        <div className="text-sm text-muted-foreground text-center space-y-2">
          <p>
            Ainda não tens conta?{" "}
            <Link href="/register" className="text-foreground font-medium hover:underline">
              Cria uma agora
            </Link>
          </p>
          <p>
            <Link href="/forgot-password" className="hover:underline">
              Esqueceste-te da password?
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
