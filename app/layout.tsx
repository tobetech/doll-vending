import type { Metadata, Viewport } from 'next'
import { Sarabun } from 'next/font/google'
import './globals.css'
import MobileOnlyGate from './components/MobileOnlyGate'

const sarabun = Sarabun({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin', 'thai'],
  display: 'swap',
})

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
  themeColor: '#0059b3',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body className={sarabun.className}>
        <MobileOnlyGate>{children}</MobileOnlyGate>
      </body>
    </html>
  )
}
