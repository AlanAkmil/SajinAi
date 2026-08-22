import './globals.css'
import { Manrope, IBM_Plex_Mono } from 'next/font/google'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata = {
  title: 'Sajin',
  description: 'Sajin — AI console dengan tampilan operator sinyal.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${manrope.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
