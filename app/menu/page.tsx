'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getSessionWithTimeout } from '@/lib/get-session-with-timeout'
import {
  FiLogOut,
  FiDollarSign,
  FiShoppingBag,
  FiPlusCircle,
  FiList,
  FiGift,
  FiUser,
} from 'react-icons/fi'
import DisneyBackground from '@/app/components/DisneyBackground'

export default function MenuPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [displayName, setDisplayName] = useState<string>('')
  const [balance, setBalance] = useState<number>(0)
  const [points, setPoints] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [showInsufficientPopup, setShowInsufficientPopup] = useState(false)
  const [vendingCheckLoading, setVendingCheckLoading] = useState(false)

  useEffect(() => {
    getSessionWithTimeout()
      .then(({ session }) => {
        if (!session?.user) {
          setLoading(false)
          router.replace('/login')
          return
        }
        const u = session.user
        setUser({ id: u.id })
        const name =
          (u.user_metadata?.full_name as string) ||
          (u.user_metadata?.name as string) ||
          u.email ||
          ''
        setDisplayName(name)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
        router.replace('/login')
      })
  }, [router])

  const applyMemberRow = useCallback(
    (data: {
      credit?: unknown
      point?: unknown
      user_name?: string | null
      email?: string | null
    }) => {
      const cred = data.credit
      const bal =
        cred != null && cred !== '' ? Number(cred) : 0
      setBalance(Number.isFinite(bal) ? bal : 0)
      setPoints(Number(data.point) ?? 0)
      const un = String(data.user_name ?? '').trim()
      if (un) setDisplayName(un)
      else if (data.email) setDisplayName(String(data.email))
    },
    []
  )

  // โหลดยอดเงินและคะแนนครั้งแรก
  useEffect(() => {
    if (!user?.id) return
    const fetchBalance = () => {
      void Promise.resolve(
        supabase
          .from('vending_member')
          .select('credit, point, email, user_name')
          .eq('id', user.id)
          .maybeSingle()
      )
        .then(({ data }) => {
          if (data) applyMemberRow(data)
        })
        .catch(() => {})
    }
    fetchBalance()
  }, [user?.id, applyMemberRow])

  // กลับมาที่แท็บ/แอป ให้ดึงยอดจาก member ใหม่
  useEffect(() => {
    if (!user?.id) return
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      void Promise.resolve(
        supabase
          .from('vending_member')
          .select('credit, point, email, user_name')
          .eq('id', user.id)
          .maybeSingle()
      )
        .then(({ data }) => {
          if (data) applyMemberRow(data)
        })
        .catch(() => {})
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [user?.id, applyMemberRow])

  // แสดง popup เมื่อถูก redirect มาจาก /vending เพราะยอดไม่เพียงพอ
  useEffect(() => {
    if (!user || loading) return
    if (searchParams.get('insufficient') === '1') {
      setShowInsufficientPopup(true)
      router.replace('/menu', { scroll: false })
    }
  }, [user, loading, searchParams, router])

  // Realtime: อัปเดตยอดเงินและคะแนนเมื่อแถว vending_member ของ user เปลี่ยน
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel('menu_balance_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vending_member',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as {
            credit?: unknown
            point?: unknown
            user_name?: string | null
            email?: string | null
          } | null
          if (row) applyMemberRow(row)
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, applyMemberRow])

  // ยอดเงินคงเหลือบนหน้าจอ = vending_member.credit เท่านั้น (อัปเดตจาก Realtime เมื่อ webhook หัก amount แล้ว)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(n)

  const handleVendingClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!user?.id || vendingCheckLoading) return
    setVendingCheckLoading(true)
    try {
      const { data } = await supabase
        .from('vending_member')
        .select('credit')
        .eq('id', user.id)
        .maybeSingle()
      const credit = data?.credit != null ? Number(data.credit) : 0
      if (credit > 0) {
        router.push('/vending')
      } else {
        setShowInsufficientPopup(true)
      }
    } finally {
      setVendingCheckLoading(false)
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

  const menuItems: { href: string; label: string; desc: string; Icon: React.ComponentType<{ className?: string }>; needCreditCheck?: boolean }[] = [
    { href: '/vending', label: 'สแกน QR Code ซื้อของ', desc: 'แสดง QR ที่ตู้กดเพื่อซื้อสินค้า', Icon: FiShoppingBag, needCreditCheck: true },
    { href: '/menu/topup', label: 'เติมเงิน', desc: 'สแกน QR ที่ตู้เติมเงิน', Icon: FiPlusCircle },
    { href: '/menu/redeem', label: 'แลกคะแนน', desc: 'แลกคะแนนสะสมเป็นของรางวัล', Icon: FiGift },
    { href: '/menu/history', label: 'ประวัติการใช้งาน', desc: 'รายการซื้อและธุรกรรม', Icon: FiList },
    { href: '/menu/profile', label: 'แก้ไขข้อมูลส่วนตัว', desc: 'อีเมลและข้อมูลสมาชิก', Icon: FiUser },
  ]

  return (
    <div className="min-h-screen relative bg-white">
      <DisneyBackground />
      <header className="bg-bill-primary text-white shadow-md relative">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-bold tracking-tight">Doll Vending</h1>
          <p className="text-sm text-white/85 mt-0.5">แอปซื้อจากตู้กด</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5 relative">
        {/* ข้อมูลผู้ใช้ + ยอดเงิน (การ์ด gradient) + คะแนน */}
        <section className="rounded-card shadow-card border border-bill-border overflow-hidden bg-white">
          <div className="bg-bill-pale px-4 py-3 border-b border-bill-border">
            <p className="text-xs text-gray-500 mb-0.5">ชื่อผู้ใช้ / อีเมล</p>
            <p className="text-gray-800 font-semibold break-all">{displayName || 'กำลังโหลด...'}</p>
          </div>
          <div className="bill-balance-gradient px-5 py-6 relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage:
                  'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M30 5c10 8 18 18 20 30-8-6-18-10-30-10S8 29 0 35c2-12 10-22 20-30z\' fill=\'%23fff\'/%3E%3C/svg%3E")',
                backgroundSize: '48px 48px',
              }}
            />
            <div className="relative flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-white border border-white/30">
                <FiDollarSign className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/90 font-medium">ยอดเงินคงเหลือ</p>
                <p className="text-2xl sm:text-3xl font-bold text-bill-gold mt-1 tabular-nums">
                  {formatCurrency(balance)}
                </p>
                <span className="inline-block mt-3 text-xs font-medium text-white/95 bg-white/15 rounded-full px-3 py-1 border border-white/20">
                  คะแนนสะสม {points} แต้ม
                </span>
              </div>
            </div>
          </div>
          <div className="px-4 py-3 bg-white border-t border-bill-border flex items-center justify-between">
            <span className="text-sm text-gray-600">คะแนนที่ใช้แลกของรางวัล</span>
            <span className="text-lg font-bold text-bill-blue">{points}</span>
          </div>
        </section>

        {/* เมนู */}
        <section className="space-y-3">
          <div className="mb-1 px-0.5">
            <h2 className="font-semibold text-gray-800">เมนู</h2>
          </div>
          {menuItems.map((item) => {
            const Icon = item.Icon
            const className =
              'flex items-center gap-4 bg-white rounded-card shadow-card border border-bill-border p-4 hover:bg-bill-pale/60 transition w-full text-left active:scale-[0.99]'
            if (item.needCreditCheck) {
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={handleVendingClick}
                  disabled={vendingCheckLoading}
                  className={className}
                >
                  <div className="w-12 h-12 rounded-xl bg-bill-pale flex items-center justify-center text-bill-primary text-2xl border border-bill-border">
                    {Icon ? <Icon className="w-6 h-6" /> : <span>•</span>}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{item.label}</p>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                  <span className="text-bill-blue/50 font-light text-xl">›</span>
                </button>
              )
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={className}
              >
                <div className="w-12 h-12 rounded-xl bg-bill-pale flex items-center justify-center text-bill-primary text-2xl border border-bill-border">
                  {Icon ? <Icon className="w-6 h-6" /> : <span>•</span>}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{item.label}</p>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
                <span className="text-bill-blue/50 font-light text-xl">›</span>
              </Link>
            )
          })}
        </section>

        {/* Popup ยอดเงินไม่เพียงพอ */}
        {showInsufficientPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-card shadow-2xl p-6 max-w-xs w-full border border-bill-border text-center">
              <p className="text-gray-800 font-medium">จำนวนเงินไม่เพียงพอ กรุณาเติมเงิน</p>
              <button
                type="button"
                onClick={() => setShowInsufficientPopup(false)}
                className="mt-4 w-full py-3 bg-bill-primary text-white rounded-card font-semibold hover:opacity-95"
              >
                ตกลง
              </button>
            </div>
          </div>
        )}

        {/* Log out */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-card border border-bill-border text-bill-primary font-medium hover:bg-bill-pale/80 transition bg-white shadow-sm"
        >
          {FiLogOut ? <FiLogOut className="w-5 h-5" /> : <span>⎋</span>}
          ออกจากระบบ (Log out)
        </button>
      </main>
    </div>
  )
}
