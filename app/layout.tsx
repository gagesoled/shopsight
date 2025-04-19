import type React from "react"
import "@/app/globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Behavioral Trend Insight Platform",
  description: "Understand WHY customers are buying based on Amazon search behavior",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <div className="min-h-screen bg-background">
            <header className="border-b">
              <div className="container mx-auto py-4 px-4 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-xl">Trend Insight</span>
                </div>
                <nav>
                  <ul className="flex space-x-6">
                    <li>
                      <a href="/" className="text-sm font-medium hover:text-primary">
                        Home
                      </a>
                    </li>
                    <li>
                      <a href="/niche-explorer" className="text-sm font-medium hover:text-primary">
                        Niche Explorer
                      </a>
                    </li>
                    <li>
                      <a href="/product-keyword-view" className="text-sm font-medium hover:text-primary">
                        Product Keywords
                      </a>
                    </li>
                  </ul>
                </nav>
              </div>
            </header>
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}


import './globals.css'