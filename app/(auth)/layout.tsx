import Link from "next/link"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-muted/40 flex flex-col">
      <header className="py-8 flex justify-center">
        <Link
          href="/"
          className="text-2xl font-semibold tracking-tight text-foreground"
        >
          ISOFlow
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="py-6 text-center text-xs text-muted-foreground">
        by ISONIQ TECH
      </footer>
    </div>
  )
}
