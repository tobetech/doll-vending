'use client'

import { useState, useEffect } from 'react'
import DisneyBackground from '@/app/components/DisneyBackground'

const MOBILE_MAX_WIDTH = 768
const isDev = process.env.NODE_ENV === 'development'

function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost')
  )
}

export default function MobileOnlyGate({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null)
  const [desktopPreview, setDesktopPreview] = useState(false)
  /** เปิดบนเครื่องตัวเอง (localhost) ไม่บังเดสก์ท็อป — แก้กรณี npm run start แล้วหน้าว่าง/ไม่เห็นแอป */
  const [skipGateLocalhost, setSkipGateLocalhost] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isLocalHost(window.location.hostname)) {
      setSkipGateLocalhost(true)
    }
    const check = () => {
      const w = window.innerWidth
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
      const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
      setIsMobile(mobileUA || w <= MOBILE_MAX_WIDTH)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // โหมดพัฒนา หรือ localhost: ใช้บน desktop ได้เลย ไม่บัง
  if (isDev || skipGateLocalhost) {
    return <>{children}</>
  }

  if (isMobile === null) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <DisneyBackground />
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-bill-primary border-t-transparent" />
      </div>
    )
  }

  if (!isMobile && !desktopPreview) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative">
        <DisneyBackground />
        <div className="w-20 h-20 rounded-full bg-white border border-bill-border flex items-center justify-center text-4xl mb-6 shadow-card">📱</div>
        <h1 className="text-2xl sm:text-xl font-bold text-bill-primary mb-2">Doll Vending</h1>
        <p className="text-lg text-gray-700 mb-1">แอปนี้ใช้ได้บนมือถือเท่านั้น</p>
        <p className="text-base text-gray-600 mb-6">กรุณาเปิดลิงก์นี้บนสมาร์ทโฟน หรือสแกน QR ด้วยมือถือ</p>
        <button
          type="button"
          onClick={() => setDesktopPreview(true)}
          className="px-5 py-3 bg-bill-primary text-white rounded-card text-lg font-semibold hover:opacity-95 transition border border-bill-blueDark/30 shadow-md"
        >
          ดูตัวอย่างบนเดสก์ท็อป
        </button>
      </div>
    )
  }

  if (!isMobile && desktopPreview) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 bg-bill-pale" />
        <div className="bg-bill-primary rounded-[2rem] p-2 shadow-2xl relative" style={{ width: 375, maxWidth: '100%' }}>
          <div className="rounded-[1.5rem] overflow-hidden bg-white" style={{ height: 667 }}>
            {children}
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
