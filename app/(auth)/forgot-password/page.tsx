import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ForgotPasswordForm } from "./forgot-password-form"

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperar password</CardTitle>
        <CardDescription>
          Indica o teu email e enviamos um link para definir uma nova password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ForgotPasswordForm />
        <p className="text-sm text-muted-foreground text-center">
          <Link href="/login" className="hover:underline">
            Voltar ao login
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
