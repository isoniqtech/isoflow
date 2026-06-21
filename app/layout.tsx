import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { RegisterServiceWorker } from "@/components/pwa/register-sw"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "ISOFlow",
    template: "%s · ISOFlow",
  },
  description:
    "Plataforma SaaS portuguesa para gestão automática de faturas, conciliação bancária e controlo de obras/projetos.",
  applicationName: "ISOFlow",
  authors: [{ name: "ISONIQ TECH" }],
  keywords: [
    "faturas",
    "conciliação bancária",
    "obras",
    "projetos",
    "SaaS",
    "Portugal",
    "ISONIQ TECH",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/icon.png", type: "image/png" }],
    shortcut: [{ url: "/icon.png", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ISOFlow",
  },
  openGraph: {
    title: "ISOFlow",
    description:
      "Plataforma SaaS portuguesa para gestão automática de faturas, conciliação bancária e controlo de obras/projetos.",
    url: APP_URL,
    siteName: "ISOFlow",
    locale: "pt_PT",
    type: "website",
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          themes={["light", "dark", "studio", "studio-dark"]}
        >
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  )
}
