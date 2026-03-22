'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getSessionWithTimeout } from '@/lib/get-session-with-timeout'
import { QrcodeSVG } from 'react-qrcode-pretty'
import { FiArrowLeft, FiRefreshCw, FiCreditCard } from 'react-icons/fi'
import DisneyBackground from '@/app/components/DisneyBackground'

const API_BASE = typeof window !== 'undefined' ? window.location.origin : ''
const COUNTDOWN_SECONDS = 120 // 2 นาที (สอดคล้องกับ token ฝั่ง API)
const COUNTDOWN_REDIRECT_AFTER_MS = 2000
const SUCCESS_SHOW_MS = 2500

export default function TopUpPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [topupToken, setTopupToken] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [tokenLoading, setTokenLoading] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null)
  const [success, setSuccess] = useState<{ amount: number } | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scanStartedAtRef = useRef<number | null>(null)

  const fetchTopupToken = useCallback(async () => {
    const { session } = await getSessionWithTimeout()
    if (!session?.access_token) {
      setTokenError('ไม่ได้เข้าสู่ระบบ')
      return
    }
    setTokenLoading(true)
    setTokenError(null)
    try {
      const res = await fetch(`${API_BASE}/api/vending/topup-qr-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ refresh_token: session.refresh_token ?? '' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTopupToken(null)
        setExpiresAt(null)
        setTokenError(json.error || `โหลดไม่สำเร็จ (${res.status})`)
        return
      }
      setTopupToken(json.token)
      setExpiresAt(json.expiresAt ?? null)
    } catch {
      setTopupToken(null)
      setExpiresAt(null)
      setTokenError('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setTokenLoading(false)
    }
  }, [])

  useEffect(() => {
    getSessionWithTimeout()
      .then(({ session }) => {
        if (!session?.user) {
          setLoading(false)
          router.replace('/login')
          return
        }
        setUser({ id: session.user.id })
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
        router.replace('/login')
      })
  }, [router])

  useEffect(() => {
    if (!user?.id) return
    fetchTopupToken()
  }, [user?.id, fetchTopupToken])

  useEffect(() => {
    if (topupToken && scanStartedAtRef.current === null) {
      scanStartedAtRef.current = Date.now()
    }
    if (!topupToken) scanStartedAtRef.current = null
  }, [topupToken])

  useEffect(() => {
    if (!topupToken || success !== null) return
    setCountdownSeconds(COUNTDOWN_SECONDS)
    let left = COUNTDOWN_SECONDS
    const tick = () => {
      left -= 1
      if (left <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current)
        setCountdownSeconds(0)
        setTimeout(() => router.replace('/menu'), COUNTDOWN_REDIRECT_AFTER_MS)
        return
      }
      setCountdownSeconds(left)
    }
    countdownRef.current = setInterval(tick, 1000)
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [topupToken, router, success])

  // Realtime: token เปลี่ยนเป็น completed
  useEffect(() => {
    if (!user?.id || !topupToken || success !== null) return
    const channel = supabase
      .channel('topup_token_completed')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vending_topup_token',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { token?: string; status?: string; amount?: number }
          if (row?.token === topupToken && row?.status === 'completed') {
            const amt = row.amount != null ? Number(row.amount) : 0
            setSuccess({ amount: amt })
            if (countdownRef.current) clearInterval(countdownRef.current)
            setTimeout(() => router.replace('/menu'), SUCCESS_SHOW_MS)
          }
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, topupToken, router, success])

  // Poll fallback
  useEffect(() => {
    if (!user?.id || !topupToken || success !== null) return
    const check = async () => {
      const { data } = await supabase
        .from('vending_topup_token')
        .select('status, amount')
        .eq('token', topupToken)
        .eq('user_id', user.id)
        .maybeSingle()
      if (data?.status === 'completed') {
        const amt = data.amount != null ? Number(data.amount) : 0
        setSuccess({ amount: amt })
        if (countdownRef.current) clearInterval(countdownRef.current)
        setTimeout(() => router.replace('/menu'), SUCCESS_SHOW_MS)
      }
    }
    const t = setInterval(check, 3000)
    check()
    return () => clearInterval(t)
  }, [user?.id, topupToken, router, success])

  const qrString =
    topupToken != null
      ? JSON.stringify({ type: 'topup', token: topupToken })
      : ''

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <DisneyBackground />
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-disney-magenta border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen relative">
      <DisneyBackground />
      <header className="bg-white/90 backdrop-blur border-b-2 border-disney-magenta-light relative">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/menu"
            className="p-2 rounded-lg hover:bg-disney-pink-pale/70 text-disney-magenta"
          >
            <FiArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold text-disney-magenta">เติมเงิน</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 relative">
        {success && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-xs border-2 border-disney-magenta-light">
              <p className="text-2xl font-bold text-disney-magenta">เติมเงินสำเร็จ</p>
              <p className="text-lg text-gray-700 mt-2">
                {success.amount.toFixed(2)} บาท
              </p>
              <p className="text-sm text-gray-500 mt-2">กำลังกลับไปหน้าเมนู...</p>
            </div>
          </div>
        )}

        <section className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border-2 border-disney-magenta-light p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-disney-magenta-soft flex items-center justify-center border-2 border-disney-magenta-light">
              <FiCreditCard className="text-disney-magenta w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-800">QR เติมเงินที่ตู้</h2>
              <p className="text-sm text-gray-500">
                แสดง QR ให้ตู้เติมเงินสแกน — ตู้จะให้ใส่จำนวนเงินแล้วยืนยันรายการ
              </p>
            </div>
          </div>

          {topupToken && countdownSeconds !== null && countdownSeconds > 0 && (
            <p className="text-center text-sm text-disney-magenta font-medium mb-3">
              QR หมดอายุใน {Math.floor(countdownSeconds / 60)}:
              {String(countdownSeconds % 60).padStart(2, '0')}
            </p>
          )}
          {expiresAt && (
            <p className="text-center text-xs text-gray-500 mb-3">
              หมดอายุ: {new Date(expiresAt).toLocaleString('th-TH')}
            </p>
          )}

          <div className="flex justify-center rounded-xl p-4 min-h-[252px] items-center border-2 border-disney-magenta-light bg-disney-pink-pale/30">
            {tokenLoading && !topupToken ? (
              <div className="flex flex-col items-center gap-2 text-disney-magenta">
                <FiRefreshCw className="w-8 h-8 animate-spin" />
                <span className="text-sm">กำลังสร้าง QR...</span>
              </div>
            ) : qrString ? (
              <div className="relative inline-block">
                <QrcodeSVG
                  value={qrString}
                  size={220}
                  level="H"
                  margin={8}
                  padding={8}
                  variant={{ eyes: 'standard', body: 'dots' }}
                  color="#000000"
                  bgColor="#ffffff"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="text-sm text-amber-600">
                  {tokenError || 'กดปุ่มด้านบนเพื่อสร้าง QR อีกครั้ง'}
                </span>
                <button
                  type="button"
                  onClick={() => fetchTopupToken()}
                  className="flex items-center gap-2 px-4 py-2 bg-disney-magenta text-white rounded-xl text-sm font-medium border-2 border-disney-magenta-light"
                >
                  <FiRefreshCw className="w-4 h-4" /> สร้าง QR
                </button>
              </div>
            )}
          </div>
          {/* ไม่แสดงปุ่ม "สร้าง QR ใหม่" ใต้ QR — สร้าง token ครั้งเดียวตอนเข้าหน้า; ถ้า error ใช้ปุ่มในช่องกลาง */}
        </section>

        <p className="text-xs text-gray-500 mt-4 text-center px-2">
          เอกสารต่อตู้: ดู <code className="bg-white/80 px-1 rounded">docs/TOPUP_MACHINE_INTEGRATION.md</code>
        </p>
      </main>
    </div>
  )
}
