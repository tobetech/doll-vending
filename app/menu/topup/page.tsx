'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FiArrowLeft, FiCreditCard, FiMinus, FiPlus } from 'react-icons/fi'
import { QrcodeSVG } from 'react-qrcode-pretty'
import DisneyBackground from '@/app/components/DisneyBackground'
import { supabase } from '@/lib/supabase'
import { getSessionWithTimeout } from '@/lib/get-session-with-timeout'
import { useWallClockCountdown } from '@/lib/use-wall-clock-countdown'
import {
  APP_QR_BACKGROUND,
  APP_QR_COLOR,
  APP_QR_ERROR_LEVEL,
  APP_QR_SIZE,
} from '@/lib/qr-display'

const API_BASE = typeof window !== 'undefined' ? window.location.origin : ''
const MIN_TOPUP_BAHT = 20
const MAX_TOPUP_BAHT = 1000
const STEP_TOPUP_BAHT = 10
const COUNTDOWN_SECONDS = 300
const SUCCESS_SHOW_MS = 2800
const POLL_MS = 3000
const IS_DEV = process.env.NODE_ENV === 'development'

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

type TopupQrPayload = {
  userID: string
  action: 'topup'
  amount: number
  token: string
}

export default function TopUpPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)
  const [selectedAmountBaht, setSelectedAmountBaht] = useState(100)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [testWebhookLoading, setTestWebhookLoading] = useState(false)
  const [testWebhookError, setTestWebhookError] = useState<string | null>(null)
  const [topupToken, setTopupToken] = useState<string | null>(null)
  const [topupAmount, setTopupAmount] = useState<number | null>(null)
  const [success, setSuccess] = useState<{ amount: number; newCredit: number } | null>(null)
  const tokenRef = useRef<string | null>(null)

  useEffect(() => {
    tokenRef.current = topupToken
  }, [topupToken])

  const fetchBalance = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('vending_member')
      .select('credit')
      .eq('id', userId)
      .maybeSingle()
    const c = data?.credit != null ? Number(data.credit) : 0
    setBalance(Number.isFinite(c) ? roundMoney(c) : 0)
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
        void fetchBalance(session.user.id)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
        router.replace('/login')
      })
  }, [fetchBalance, router])

  const onCountdownEnd = useCallback(() => {
    setTopupToken(null)
    setTopupAmount(null)
    setCreateError('หมดเวลาแสดง QR — กรุณาสร้างใหม่')
    setTimeout(() => setCreateError(null), 3500)
  }, [])

  const countdownSeconds = useWallClockCountdown(
    Boolean(topupToken) && success === null,
    COUNTDOWN_SECONDS,
    onCountdownEnd
  )

  const qrPayload = useMemo<TopupQrPayload | null>(() => {
    if (!user?.id || !topupToken || topupAmount == null) return null
    return {
      userID: user.id,
      action: 'topup',
      amount: topupAmount,
      token: topupToken,
    }
  }, [user?.id, topupToken, topupAmount])

  const qrValue = qrPayload ? JSON.stringify(qrPayload) : ''

  const applySuccess = useCallback(
    async (amount: number) => {
      if (!user?.id || success) return
      await fetchBalance(user.id)
      const { data: mem } = await supabase
        .from('vending_member')
        .select('credit')
        .eq('id', user.id)
        .maybeSingle()
      const nc = mem?.credit != null ? roundMoney(Number(mem.credit)) : 0
      setSuccess({ amount: roundMoney(amount), newCredit: nc })
      setTimeout(() => router.replace('/menu'), SUCCESS_SHOW_MS)
    },
    [fetchBalance, router, success, user?.id]
  )

  useEffect(() => {
    if (!user?.id) return
    const uid = user.id
    const channel = supabase
      .channel(`topup_token_${uid}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vending_topup_token',
          filter: `user_id=eq.${uid}`,
        },
        (payload) => {
          const row = payload.new as { token?: string; status?: string; amount?: number | string }
          if (row?.token === tokenRef.current && row?.status === 'completed') {
            const amt = row.amount != null ? Number(row.amount) : Number(topupAmount ?? 0)
            void applySuccess(Number.isFinite(amt) ? amt : 0)
          }
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [applySuccess, topupAmount, user?.id])

  const pollTopupStatus = useCallback(async () => {
    const token = tokenRef.current
    if (!token || success) return
    const { data } = await supabase
      .from('vending_topup_token')
      .select('status, amount')
      .eq('token', token)
      .maybeSingle()
    if (data?.status === 'completed') {
      const amt = data.amount != null ? Number(data.amount) : Number(topupAmount ?? 0)
      await applySuccess(Number.isFinite(amt) ? amt : 0)
    }
  }, [applySuccess, success, topupAmount])

  useEffect(() => {
    if (!topupToken || success !== null) return
    const t = setInterval(() => void pollTopupStatus(), POLL_MS)
    void pollTopupStatus()
    return () => clearInterval(t)
  }, [pollTopupStatus, success, topupToken])

  const handleCreateQr = async () => {
    if (!user?.id) return
    setCreating(true)
    setCreateError(null)
    setTopupToken(null)
    setTopupAmount(null)
    try {
      const { session } = await getSessionWithTimeout()
      if (!session?.access_token) {
        setCreateError('ไม่ได้เข้าสู่ระบบ')
        return
      }
      const res = await fetch(`${API_BASE}/api/vending/topup-qr-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          refresh_token: session.refresh_token ?? '',
          amount: selectedAmountBaht,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCreateError(json.error || `สร้าง QR ไม่สำเร็จ (${res.status})`)
        return
      }
      setTopupToken(String(json.token ?? ''))
      setTopupAmount(
        json.amount != null && Number.isFinite(Number(json.amount))
          ? roundMoney(Number(json.amount))
          : roundMoney(selectedAmountBaht)
      )
    } catch {
      setCreateError('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setCreating(false)
    }
  }

  const adjustAmount = useCallback((delta: number) => {
    setSelectedAmountBaht((prev) =>
      Math.max(MIN_TOPUP_BAHT, Math.min(MAX_TOPUP_BAHT, prev + delta))
    )
  }, [])

  const handleTestWebhook = async () => {
    if (!qrPayload) return
    setTestWebhookLoading(true)
    setTestWebhookError(null)
    try {
      const res = await fetch(`${API_BASE}/api/webhook/vending-topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: qrPayload.token,
          userId: qrPayload.userID,
          action: qrPayload.action,
          amount: qrPayload.amount,
          machineId: 'test-machine',
          transactionId: `test-${Date.now()}`,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTestWebhookError(json.error || `ทดสอบ webhook ไม่สำเร็จ (${res.status})`)
        return
      }
      if (json.duplicate) {
        setTestWebhookError('รายการนี้เคยเติมสำเร็จแล้ว')
        return
      }
      await applySuccess(qrPayload.amount)
    } catch {
      setTestWebhookError('ส่ง webhook ไม่ได้ กรุณาลองใหม่')
    } finally {
      setTestWebhookLoading(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <DisneyBackground />
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-bill-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen relative bg-white">
      <DisneyBackground />
      <header className="bg-bill-primary text-white shadow-md relative">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/menu" className="p-2 rounded-lg hover:bg-white/10 text-white">
            <FiArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold">เติมเงิน</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 relative">
        {success && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-card shadow-2xl p-8 text-center max-w-xs border border-bill-border">
              <p className="text-2xl font-bold text-bill-primary">เติมเงินสำเร็จ</p>
              <p className="text-lg text-gray-700 mt-2">+{success.amount.toFixed(2)} บาท</p>
              <p className="text-sm text-gray-600 mt-3">
                ยอดเงินคงเหลือ{' '}
                <span className="font-bold text-bill-blue tabular-nums">
                  {new Intl.NumberFormat('th-TH', {
                    style: 'currency',
                    currency: 'THB',
                  }).format(success.newCredit)}
                </span>
              </p>
              <p className="text-sm text-gray-500 mt-2">กำลังกลับไปหน้าเมนู...</p>
            </div>
          </div>
        )}

        <section className="bg-white rounded-card shadow-card border border-bill-border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-bill-pale flex items-center justify-center border border-bill-border">
              <FiCreditCard className="text-bill-primary w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-800">เติมเงินผ่านตู้ขายสินค้า</h2>
              <p className="text-sm text-gray-500">
                เลือกยอด แล้วสร้าง QR ให้ตู้สแกนเพื่อนำไปชำระผ่าน Ksher
              </p>
            </div>
          </div>

          <div className="rounded-card border border-bill-border bg-bill-pale/40 px-4 py-3">
            <p className="text-xs text-gray-500">ยอดเงินคงเหลือ</p>
            <p className="text-xl font-bold text-bill-blue tabular-nums">
              {new Intl.NumberFormat('th-TH', {
                style: 'currency',
                currency: 'THB',
              }).format(balance)}
            </p>
          </div>

          {topupToken && (
            <>
              {countdownSeconds !== null && countdownSeconds > 0 && (
                <p className="text-center text-sm text-bill-primary font-semibold">
                  QR หมดอายุใน {Math.floor(countdownSeconds / 60)}:
                  {String(countdownSeconds % 60).padStart(2, '0')}
                </p>
              )}
              <div className="w-full border border-bill-border rounded-card p-4 bg-bill-pale/40 flex justify-center">
                {qrPayload ? (
                  <QrcodeSVG
                    value={qrValue}
                    size={APP_QR_SIZE}
                    level={APP_QR_ERROR_LEVEL}
                    margin={6}
                    padding={6}
                    variant={{ eyes: 'standard', body: 'dots' }}
                    color={APP_QR_COLOR}
                    bgColor={APP_QR_BACKGROUND}
                  />
                ) : null}
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  userID: <span className="font-semibold">{user.id}</span>
                </p>
                <p>
                  action: <span className="font-semibold">topup</span>
                </p>
                <p>
                  amount:{' '}
                  <span className="font-semibold">
                    {new Intl.NumberFormat('th-TH', {
                      style: 'currency',
                      currency: 'THB',
                    }).format(topupAmount ?? 0)}
                  </span>
                </p>
              </div>
            </>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              เลือกจำนวนเงินที่ต้องการเติม (บาท)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => adjustAmount(-STEP_TOPUP_BAHT)}
                disabled={
                  (Boolean(topupToken) && success === null) ||
                  selectedAmountBaht <= MIN_TOPUP_BAHT
                }
                className="w-12 h-12 rounded-card border border-bill-border flex items-center justify-center text-bill-primary hover:bg-bill-pale/60 disabled:opacity-50"
                aria-label="ลดจำนวนเงิน"
              >
                <FiMinus className="w-5 h-5" />
              </button>
              <div className="flex-1 rounded-card border border-bill-border bg-white px-4 py-3 text-center">
                <p className="text-xs text-gray-500">จำนวนเงินที่เลือก</p>
                <p className="text-xl font-bold text-bill-blue tabular-nums">
                  {new Intl.NumberFormat('th-TH', {
                    style: 'currency',
                    currency: 'THB',
                  }).format(selectedAmountBaht)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => adjustAmount(STEP_TOPUP_BAHT)}
                disabled={
                  (Boolean(topupToken) && success === null) ||
                  selectedAmountBaht >= MAX_TOPUP_BAHT
                }
                className="w-12 h-12 rounded-card border border-bill-border flex items-center justify-center text-bill-primary hover:bg-bill-pale/60 disabled:opacity-50"
                aria-label="เพิ่มจำนวนเงิน"
              >
                <FiPlus className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              เพิ่ม/ลดครั้งละ {STEP_TOPUP_BAHT} บาท (ขั้นต่ำ {MIN_TOPUP_BAHT} สูงสุด {MAX_TOPUP_BAHT})
            </p>
          </div>

          {createError && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {createError}
            </p>
          )}

          {!topupToken ? (
            <button
              type="button"
              onClick={() => void handleCreateQr()}
              disabled={creating}
              className="w-full py-3 bg-bill-primary text-white rounded-card font-semibold border border-bill-blueDark/30 hover:opacity-95 disabled:opacity-50"
            >
              {creating ? 'กำลังสร้าง QR...' : 'ตกลง'}
            </button>
          ) : (
            <>
              {IS_DEV && (
                <>
                  {testWebhookError && (
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      {testWebhookError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleTestWebhook()}
                    disabled={testWebhookLoading}
                    className="w-full py-2 text-sm text-white bg-emerald-600 border border-emerald-700 rounded-card hover:opacity-95 disabled:opacity-50"
                  >
                    {testWebhookLoading ? 'กำลังทดสอบ...' : 'ทดสอบ webhook (เครื่องจำลอง)'}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setTopupToken(null)
                  setTopupAmount(null)
                }}
                className="w-full py-2 text-sm text-bill-primary border border-bill-border rounded-card hover:bg-bill-pale/60"
              >
                ยกเลิก / สร้าง QR ใหม่
              </button>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
