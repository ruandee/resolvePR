import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { Providers } from "@/lib/providers"
import "./globals.css"

const inter = Inter({ 
  variable: "--font-inter", 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})
const jetbrainsMono = JetBrains_Mono({ 
  variable: "--font-jetbrains-mono", 
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

export const metadata: Metadata = {
  title: "ResolvePR",
  description: "Instant AI-powered security review for every pull request.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-background">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable}`}
        style={{ margin: 0, padding: 0 }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
