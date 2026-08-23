import './globals.css'
import { Work_Sans, Shippori_Mincho } from 'next/font/google'

const workSans = Work_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const shippori = Shippori_Mincho({
  subsets: ['latin'],
  weight: ['400', '600', '800'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata = {
  title: 'Sajin',
  description: 'Sajin — AI console dengan wibawa Kapten Divisi 7.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${workSans.variable} ${shippori.variable}`}>
      <body>{children}</body>
    </html>
  )
}
