import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import MobileOnlyGate from './components/MobileOnlyGate'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Doll Vending - แอปซื้อจากตู้กด',
  description: 'ซื้อสินค้าจากตู้จำหน่ายอัตโนมัติด้วย QR ประจำตัว',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Doll Vending',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#E91E8C',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body className={inter.className}>
        <MobileOnlyGate>{children}</MobileOnlyGate>
      </body>
    </html>
  )
}
