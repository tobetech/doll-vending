'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getSessionWithTimeout } from '@/lib/get-session-with-timeout'
import { QrcodeSVG } from 'react-qrcode-pretty'
import { FiArrowLeft, FiMinus, FiPlus, FiRefreshCw, FiUser, FiShield } from 'react-icons/fi'
import DisneyBackground from '@/app/components/DisneyBackground'
import {
  APP_QR_SIZE,
  APP_QR_ERROR_LEVEL,
  APP_QR_COLOR,
  APP_QR_BACKGROUND,
  APP_QR_BODY_COLOR,
} from '@/lib/qr-display'
import { useWallClockCountdown } from '@/lib/use-wall-clock-countdown'

const API_BASE = typeof window !== 'undefined' ? window.location.origin : ''
const COUNTDOWN_SECONDS = 90 // 1:30 นาที
const COUNTDOWN_REDIRECT_AFTER_MS = 1500
const WEBHOOK_RESULT_SHOW_MS = 2500
/** ตรงกับฝั่ง API qr-token / validate */
const PRICE_PER_UNIT = 10
const MIN_QUANTITY = 10

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export default function VendingScanPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [qrToken, setQrToken] = useState<string | null>(null)
  const [qrExpiresAt, setQrExpiresAt] = useState<string | null>(null)
  const [qrTokenLoading, setQrTokenLoading] = useState(false)
  const [qrError, setQrError] = useState<string | null>(null)
  const [webhookResult, setWebhookResult] = useState<'success' | 'failed' | null>(null)
  const [successSummary, setSuccessSummary] = useState<{
    amount: number
    productName?: string
    /** ยอดคงเหลือหลังรายการ (= newCredit จาก webhook / credit_after) */
    newCredit?: number
  } | null>(null)
  const [testWebhookLoading, setTestWebhookLoading] = useState(false)
  const [testWebhookError, setTestWebhookError] = useState<string | null>(null)
  const [creditOk, setCreditOk] = useState<boolean | null>(null)
  const [memberCredit, setMemberCredit] = useState<number>(0)
  const [maxQuantity, setMaxQuantity] = useState(10)
  const [quantity, setQuantity] = useState(10)
  const scanStartedAtRef = useRef<number | null>(null)
  const redirectingRef = useRef(false)
  const qrFetchSeqRef = useRef(0)

  const isDev = typeof window !== 'undefined' && process.env.NODE_ENV === 'development'

  const onCountdownEnd = useCallback(() => {
    setTimeout(() => router.replace('/menu'), COUNTDOWN_REDIRECT_AFTER_MS)
  }, [router])

  const countdownSeconds = useWallClockCountdown(
    Boolean(qrToken) && webhookResult === null,
    COUNTDOWN_SECONDS,
    onCountdownEnd
  )

  const handleTestWebhookSuccess = async () => {
    if (!user?.id) return
    setTestWebhookLoading(true)
    setTestWebhookError(null)
    try {
      const res = await fetch(`${API_BASE}/api/webhook/vending`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          machineId: 'test-machine',
          productName: 'สินค้าทดสอบ',
          amount: quantity * PRICE_PER_UNIT,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        // จำลองผลสำเร็จทันที (ไม่ต้องรอ Realtime) — webhookResult ทำให้ countdown หยุด
        const nc =
          json.newCredit != null && Number.isFinite(Number(json.newCredit))
            ? Number(json.newCredit)
            : undefined
        setSuccessSummary({
          amount: quantity * PRICE_PER_UNIT,
          productName: 'สินค้าทดสอบ',
          newCredit: nc,
        })
        setWebhookResult('success')
        setTimeout(() => router.replace('/menu'), WEBHOOK_RESULT_SHOW_MS)
      } else {
        setTestWebhookError(json.error || `Webhook ล้มเหลว (${res.status})`)
      }
    } catch (e) {
      setTestWebhookError('ส่ง Webhook ไม่ได้ เช็คการเชื่อมต่อหรือ Console')
    } finally {
      setTestWebhookLoading(false)
    }
  }

  const fetchQrToken = useCallback(async (purchaseAmount: number) => {
    const { session } = await getSessionWithTimeout()
    if (!session?.access_token) {
      setQrError('ไม่ได้เข้าสู่ระบบ')
      return
    }
    const seq = ++qrFetchSeqRef.current
    setQrTokenLoading(true)
    setQrError(null)
    try {
      const res = await fetch(`${API_BASE}/api/vending/qr-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          refresh_token: session.refresh_token ?? '',
          amount: roundMoney(purchaseAmount),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (seq !== qrFetchSeqRef.current) return
      if (!res.ok) {
        setQrToken(null)
        setQrExpiresAt(null)
        setQrError(json.error || `โหลดไม่สำเร็จ (${res.status})`)
        return
      }
      setQrToken(json.token)
      setQrExpiresAt(json.expiresAt ?? null)
    } catch (e) {
      if (seq !== qrFetchSeqRef.current) return
      setQrToken(null)
      setQrExpiresAt(null)
      setQrError('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      if (seq === qrFetchSeqRef.current) setQrTokenLoading(false)
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

  // เช็ค credit ก่อนให้เข้าได้ — ถ้าเท่ากับ 0 หรือไม่มีแถว/error กลับไปหน้าเมนู (มี timeout กัน query ค้าง)
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    redirectingRef.current = false
    const failRedirect = () => {
      if (cancelled || redirectingRef.current) return
      redirectingRef.current = true
      router.replace('/menu?insufficient=1')
    }
    const hangTimer = setTimeout(() => {
      if (cancelled) return
      failRedirect()
    }, 15_000)

    void Promise.resolve(
      supabase
        .from('vending_member')
        .select('credit')
        .eq('id', user.id)
        .maybeSingle()
    )
      .then(({ data, error }) => {
        clearTimeout(hangTimer)
        if (cancelled) return
        const credit = roundMoney(data?.credit != null ? Number(data.credit) : 0)
        const maxQ = Math.floor(credit / PRICE_PER_UNIT)
        if (error || maxQ < MIN_QUANTITY) {
          failRedirect()
          return
        }
        if (redirectingRef.current) return
        setMemberCredit(credit)
        setMaxQuantity(maxQ)
        setQuantity(maxQ)
        setCreditOk(true)
      })
      .catch(() => {
        clearTimeout(hangTimer)
        failRedirect()
      })
    return () => {
      cancelled = true
      clearTimeout(hangTimer)
    }
  }, [user?.id, router])

  const clearQr = useCallback(() => {
    setQrToken(null)
    setQrExpiresAt(null)
    setQrError(null)
  }, [])

  const adjustQuantity = useCallback(
    (delta: number) => {
      clearQr()
      setQuantity((q) =>
        Math.max(MIN_QUANTITY, Math.min(maxQuantity, q + delta))
      )
    },
    [maxQuantity, clearQr]
  )

  const handleConfirmQuantity = useCallback(() => {
    void fetchQrToken(quantity * PRICE_PER_UNIT)
  }, [quantity, fetchQrToken])

  // เก็บเวลาเมื่อเริ่มแสดง QR (ใช้กับ polling)
  useEffect(() => {
    if (qrToken && scanStartedAtRef.current === null) {
      scanStartedAtRef.current = Date.now()
    }
    if (!qrToken) scanStartedAtRef.current = null
  }, [qrToken])

  // รับ webhook (realtime) → แสดงสำเร็จ/ล้มเหลว → กลับเมนู
  useEffect(() => {
    if (!user?.id || webhookResult !== null) return
    const channel = supabase
      .channel('vending_scan_result')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vending_transactions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as {
            status?: string
            amount?: unknown
            product_name?: string | null
            credit_after?: unknown
          }
          const status = row?.status === 'success' ? 'success' : 'failed'
          if (status === 'success') {
            const ca = row?.credit_after
            const newCredit =
              ca != null && ca !== '' && Number.isFinite(Number(ca))
                ? Number(ca)
                : undefined
            setSuccessSummary({
              amount: Number(row?.amount) || 0,
              productName: row?.product_name || undefined,
              newCredit,
            })
          }
          setWebhookResult(status)
          setTimeout(() => router.replace('/menu'), WEBHOOK_RESULT_SHOW_MS)
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, router, webhookResult])

  // Fallback: ถ้า Realtime ไม่ส่ง (เช่นยังไม่ได้เปิดใน Supabase) ให้ poll ตรวจสอบรายการใหม่ทุก 3 วินาที
  useEffect(() => {
    if (!user?.id || !qrToken || webhookResult !== null) return
    const startedAt = scanStartedAtRef.current ?? Date.now()
    const check = async () => {
      const { data } = await supabase
        .from('vending_transactions')
        .select('id, status, created_at, amount, product_name, credit_after')
        .eq('user_id', user.id)
        .gte('created_at', new Date(startedAt - 5000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) {
        const status = data.status === 'success' ? 'success' : 'failed'
        if (status === 'success') {
          const d = data as {
            amount?: unknown
            product_name?: string
            credit_after?: unknown
          }
          const ca = d.credit_after
          const newCredit =
            ca != null && ca !== '' && Number.isFinite(Number(ca))
              ? Number(ca)
              : undefined
          setSuccessSummary({
            amount: Number(d.amount) || 0,
            productName: d.product_name || undefined,
            newCredit,
          })
        }
        setWebhookResult(status)
        setTimeout(() => router.replace('/menu'), WEBHOOK_RESULT_SHOW_MS)
      }
    }
    const t = setInterval(check, 3000)
    check()
    return () => clearInterval(t)
  }, [user?.id, qrToken, webhookResult])

  const qrString = qrToken ? JSON.stringify({ token: qrToken }) : ''

  if (loading || !user || creditOk !== true) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-white">
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
          <Link
            href="/menu"
            className="p-2 rounded-lg hover:bg-white/10 transition text-white"
          >
            <FiArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold">สแกน QR Code ซื้อของ</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 relative">
        {/* แสดงผลสำเร็จ/ล้มเหลว หลังได้ webhook */}
        {webhookResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div
              className={`bg-white rounded-card shadow-2xl p-8 text-center max-w-xs border ${
                webhookResult === 'success' ? 'border-bill-border text-bill-primary' : 'border-red-200 text-red-600'
              }`}
            >
              <p className="text-2xl font-bold">
                {webhookResult === 'success' ? 'สำเร็จ' : 'ล้มเหลว'}
              </p>
              {webhookResult === 'success' && successSummary && (
                <div className="mt-3 text-left text-sm text-gray-700 space-y-1">
                  {successSummary.productName ? (
                    <p>
                      <span className="text-gray-500">สินค้า:</span>{' '}
                      {successSummary.productName}
                    </p>
                  ) : null}
                  <p>
                    <span className="text-gray-500">หักจากยอดเงิน:</span>{' '}
                    <span className="font-semibold text-bill-blue">
                      {new Intl.NumberFormat('th-TH', {
                        style: 'currency',
                        currency: 'THB',
                      }).format(successSummary.amount)}
                    </span>
                  </p>
                  {successSummary.newCredit != null ? (
                    <p>
                      <span className="text-gray-500">ยอดเงินคงเหลือ:</span>{' '}
                      <span className="font-semibold text-bill-blue">
                        {new Intl.NumberFormat('th-TH', {
                          style: 'currency',
                          currency: 'THB',
                        }).format(successSummary.newCredit)}
                      </span>
                    </p>
                  ) : null}
                </div>
              )}
              <p className="text-sm text-gray-500 mt-2">
                กำลังกลับไปหน้าเมนู...
              </p>
            </div>
          </div>
        )}

        <section className="bg-white rounded-card shadow-card border border-bill-border p-6 relative overflow-hidden">
          <div className="bg-bill-pale -mx-6 -mt-6 px-6 py-3 mb-4 border-b border-bill-border flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center border border-bill-border bg-white text-bill-primary">
              <FiUser className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-800">QR ประจำตัว (Dynamic)</h2>
              <p className="text-sm text-gray-500">ยืนยันจำนวนแล้วแสดง QR ที่ตู้กด · ใช้ได้ครั้งเดียว</p>
            </div>
            <FiShield className="w-5 h-5 text-bill-primary" />
          </div>

          {/* QR แสดงด้านบน — หลังกดยืนยันจำนวน */}
          <div
            className={`flex w-full justify-center overflow-x-auto rounded-card border border-bill-border bg-bill-pale/40 items-center ${
              qrToken || qrTokenLoading
                ? 'p-3 sm:p-4 min-h-[min(85vw,380px)] sm:min-h-[380px]'
                : 'p-8 min-h-[160px]'
            } mb-4`}
          >
            {qrTokenLoading ? (
              <div className="flex flex-col items-center gap-2 text-bill-primary">
                <FiRefreshCw className="w-8 h-8 animate-spin" />
                <span className="text-sm">กำลังสร้าง QR...</span>
              </div>
            ) : qrString ? (
              <div className="relative inline-block p-2 sm:p-3 bg-black rounded-xl shadow-lg">
                <div className="bg-white rounded-lg p-1.5 sm:p-2">
                  <QrcodeSVG
                    value={qrString}
                    size={APP_QR_SIZE}
                    level={APP_QR_ERROR_LEVEL}
                    margin={6}
                    padding={6}
                    variant={{ eyes: 'standard', body: 'dots' }}
                    color={APP_QR_COLOR}
                    bgColor={APP_QR_BACKGROUND}
                  />
                </div>
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  aria-hidden
                >
                  <div className="bg-white border-2 border-black px-3 py-2 shadow-sm">
                    <span
                      className="text-xs sm:text-sm font-bold tracking-tight uppercase whitespace-nowrap"
                      style={{ color: APP_QR_BODY_COLOR }}
                    >
                      Doll-Vending
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center px-2">
                <p className="text-sm text-gray-600">
                  เลือกจำนวนสินค้าด้านล่าง แล้วกด <span className="font-semibold text-bill-primary">ยืนยันจำนวนซื้อ</span> เพื่อแสดง QR
                </p>
                {qrError ? (
                  <>
                    <p className="text-sm text-amber-600">{qrError}</p>
                    <button
                      type="button"
                      onClick={handleConfirmQuantity}
                      disabled={qrTokenLoading}
                      className="flex items-center gap-2 px-4 py-2 text-white rounded-card text-sm font-semibold hover:opacity-95 border border-bill-blueDark/40 bg-bill-primary disabled:opacity-50"
                    >
                      <FiRefreshCw className="w-4 h-4" /> ลองใหม่
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </div>

          {/* เวลานับถอยหลัง — ใต้ QR */}
          {countdownSeconds !== null && countdownSeconds > 0 && !webhookResult && qrToken && (
            <div className="mb-4 text-center">
              <p className="text-sm text-gray-600">QR หมดอายุใน</p>
              <p className="text-2xl font-bold tabular-nums text-bill-primary">
                {Math.floor(countdownSeconds / 60)}:{(countdownSeconds % 60).toString().padStart(2, '0')}
              </p>
              <p className="text-xs text-gray-500 mt-1">หมดเวลาจะกลับหน้าเมนูอัตโนมัติ</p>
            </div>
          )}
          {countdownSeconds === 0 && !webhookResult && qrToken && (
            <p className="mb-4 text-center text-sm text-gray-500">หมดเวลา กำลังกลับหน้าเมนู...</p>
          )}

          <div className="rounded-card border border-bill-border bg-bill-pale/50 p-4">
            <p className="text-sm font-medium text-gray-800">เลือกจำนวนสินค้า</p>
            <p className="text-xs text-gray-500 mt-0.5">
              ชิ้นละ {PRICE_PER_UNIT} บาท · ขั้นต่ำ {MIN_QUANTITY} ชิ้น · สูงสุดได้ไม่เกิน {maxQuantity} ชิ้น
              (ยอดคงเหลือ{' '}
              {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(
                memberCredit
              )}
              )
            </p>
            <div className="flex items-center justify-center gap-4 mt-4">
              <button
                type="button"
                aria-label="ลดจำนวน"
                disabled={quantity <= MIN_QUANTITY || qrTokenLoading}
                onClick={() => adjustQuantity(-1)}
                className="w-11 h-11 rounded-xl border border-bill-border bg-white text-bill-primary flex items-center justify-center hover:bg-bill-pale disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FiMinus className="w-5 h-5" />
              </button>
              <div className="min-w-[4.5rem] text-center">
                <p className="text-3xl font-bold tabular-nums text-gray-900">{quantity}</p>
                <p className="text-xs text-gray-500">ชิ้น</p>
              </div>
              <button
                type="button"
                aria-label="เพิ่มจำนวน"
                disabled={quantity >= maxQuantity || qrTokenLoading}
                onClick={() => adjustQuantity(1)}
                className="w-11 h-11 rounded-xl border border-bill-border bg-white text-bill-primary flex items-center justify-center hover:bg-bill-pale disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FiPlus className="w-5 h-5" />
              </button>
            </div>
            <p className="text-center text-sm font-semibold text-bill-blue mt-3">
              รวม{' '}
              {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(
                quantity * PRICE_PER_UNIT
              )}
            </p>
            <p className="text-xs text-center text-gray-500 mt-1">
              เปลี่ยนจำนวนแล้วต้องกดยืนยันอีกครั้งเพื่อสร้าง QR ใหม่
            </p>
            <button
              type="button"
              onClick={handleConfirmQuantity}
              disabled={qrTokenLoading}
              className="mt-4 w-full py-3 bg-bill-primary text-white rounded-card font-semibold border border-bill-blueDark/30 hover:opacity-95 disabled:opacity-50"
            >
              {qrTokenLoading ? 'กำลังสร้าง QR...' : 'ยืนยันจำนวนซื้อและสร้าง QR'}
            </button>
          </div>

          {/* ปุ่มทดสอบ Webhook — แสดงเฉพาะโหมด development */}
          {isDev && user?.id && !webhookResult && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">ทดสอบเมื่อตู้กดส่ง webhook กลับมา</p>
              <button
                type="button"
                onClick={handleTestWebhookSuccess}
                disabled={testWebhookLoading}
                className="w-full py-2 rounded-xl text-sm font-medium border-2 border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              >
                {testWebhookLoading ? 'กำลังส่ง...' : 'จำลอง Webhook (ตู้กดทำรายการสำเร็จ)'}
              </button>
              {testWebhookError && (
                <p className="text-xs text-red-600 mt-2">{testWebhookError}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                User ID: <code className="break-all">{user.id}</code>
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
