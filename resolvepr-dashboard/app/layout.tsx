import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans, Roboto_Mono } from 'next/font/google'
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site'
import './globals.css'

const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
})

const plexSans = IBM_Plex_Sans({
  variable: '--font-plex-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const robotoMono = Roboto_Mono({
  variable: '--font-roboto-mono',
  subsets: ['latin'],
  weight: ['500'],
})

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — AI security review for pull requests`,
    template: `%s · ${SITE_NAME}`,
  },
  description: `${SITE_TAGLINE} ResolvePR uses tree-sitter to extract only the functions a PR touched and sends those to Claude, then posts inline suggestions and a check run.`,
  icons: { icon: '/resolvepr-shield.svg' },
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${plexSans.variable} ${plexMono.variable} ${robotoMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
