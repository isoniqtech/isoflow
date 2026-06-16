import Link from "next/link"
import { Compass } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-muted/30">
      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
        <Compass className="h-7 w-7 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">
        Página não encontrada
      </h1>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        O caminho que tentaste abrir não existe ou foi movido.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        <Button asChild>
          <Link href="/dashboard">Ir para o dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/login">Entrar</Link>
        </Button>
      </div>
    </div>
  )
}
