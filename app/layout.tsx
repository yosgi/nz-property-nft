import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Navbar from "@/components/navbar"
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/next"
import { ContractProvider } from "./contexts/ContractProvider"
import { Toaster } from "sonner"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Property NFT Platform",
  description: "A decentralized platform for property NFTs and valuations",
  generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/static/cesium/Widgets/widgets.css" />
      </head>
      <body className={inter.className}>
        <Analytics />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ContractProvider>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <main className="flex-1 container mx-auto px-4 py-8">
                {children}
              </main>
            </div>
            <Toaster position="top-right" />
          </ContractProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
