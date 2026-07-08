import type { Metadata, Viewport } from "next"
import { Inter, Space_Grotesk } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { RegisterServiceWorker } from "@/components/pwa/register-sw"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
})

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
    { media: "(prefers-color-scheme: light)", color: "#F5F8EF" },
    { media: "(prefers-color-scheme: dark)", color: "#070C08" },
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
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="finmed-light"
          enableSystem={false}
          disableTransitionOnChange
          themes={["light", "dark", "studio", "studio-dark", "finmed-light", "finmed-dark"]}
        >
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  )
}
