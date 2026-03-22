'use client'

import { useState, useEffect } from 'react'
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
          if (data) {
            setBalance(Number(data.credit) ?? 0)
            setPoints(Number(data.point) ?? 0)
            const un = String((data as { user_name?: string }).user_name ?? '').trim()
            if (un) setDisplayName(un)
            else if (data.email) setDisplayName(String(data.email))
          }
        })
        .catch(() => {})
    }
    fetchBalance()
  }, [user?.id])

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
            credit?: number
            point?: number
            user_name?: string
            email?: string
          } | null
          if (row) {
            setBalance(Number(row.credit) ?? 0)
            setPoints(Number(row.point) ?? 0)
            const un = String(row.user_name ?? '').trim()
            if (un) setDisplayName(un)
            else if (row.email) setDisplayName(String(row.email))
          }
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

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
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-disney-magenta border-t-transparent" />
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
    <div className="min-h-screen relative">
      <DisneyBackground />
      <header className="bg-white/90 backdrop-blur border-b-2 border-disney-magenta-light relative">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-disney-magenta">Doll Vending</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6 relative">
        {/* ยอดเงินคงเหลือ และคะแนนสะสม */}
        <section className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border-2 border-disney-magenta-light p-5">
          <div className="bg-disney-pink-pale/80 rounded-xl px-4 py-3 mb-4 border border-disney-magenta-light">
            <p className="text-xs text-gray-500 mb-0.5">ชื่อผู้ใช้ / อีเมล</p>
            <p className="text-gray-800 font-semibold break-all">{displayName || 'กำลังโหลด...'}</p>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-disney-magenta-soft flex items-center justify-center text-disney-magenta text-xl border-2 border-disney-magenta-light">
              {FiDollarSign ? <FiDollarSign className="w-5 h-5" /> : <span>฿</span>}
            </div>
            <h2 className="font-semibold text-gray-800">ยอดเงินคงเหลือ และคะแนนสะสม</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-disney-pink-pale/70 rounded-xl p-4 text-center border-2 border-disney-magenta-light">
              <p className="text-xs text-gray-600 mb-1">ยอดเงินคงเหลือ</p>
              <p className="text-xl font-bold text-disney-magenta">{formatCurrency(balance)}</p>
            </div>
            <div className="bg-disney-magenta-soft rounded-xl p-4 text-center border-2 border-disney-magenta-light">
              <p className="text-xs text-gray-600 mb-1">คะแนนสะสม</p>
              <p className="text-xl font-bold text-disney-rose">{points} คะแนน</p>
            </div>
          </div>
        </section>

        {/* เมนู */}
        <section className="space-y-3">
          <div className="mb-3">
            <h2 className="font-semibold text-gray-800">เมนู</h2>
          </div>
          {menuItems.map((item) => {
            const Icon = item.Icon
            const className = 'flex items-center gap-4 bg-white/95 backdrop-blur rounded-xl shadow border-2 border-disney-magenta-light p-4 hover:bg-disney-pink-pale/50 transition w-full text-left'
            if (item.needCreditCheck) {
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={handleVendingClick}
                  disabled={vendingCheckLoading}
                  className={className}
                >
                  <div className="w-12 h-12 rounded-xl bg-disney-magenta-soft flex items-center justify-center text-disney-magenta text-2xl border-2 border-disney-magenta-light">
                    {Icon ? <Icon className="w-6 h-6" /> : <span>•</span>}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{item.label}</p>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                  <span className="text-gray-400">›</span>
                </button>
              )
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={className}
              >
                <div className="w-12 h-12 rounded-xl bg-disney-magenta-soft flex items-center justify-center text-disney-magenta text-2xl border-2 border-disney-magenta-light">
                  {Icon ? <Icon className="w-6 h-6" /> : <span>•</span>}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{item.label}</p>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
                <span className="text-gray-400">›</span>
              </Link>
            )
          })}
        </section>

        {/* Popup ยอดเงินไม่เพียงพอ */}
        {showInsufficientPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-xs w-full border-2 border-disney-magenta-light text-center">
              <p className="text-gray-800 font-medium">จำนวนเงินไม่เพียงพอ กรุณาเติมเงิน</p>
              <button
                type="button"
                onClick={() => setShowInsufficientPopup(false)}
                className="mt-4 w-full py-2.5 bg-disney-magenta text-white rounded-xl font-medium hover:opacity-90"
              >
                ตกลง
              </button>
            </div>
          </div>
        )}

        {/* Log out */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-disney-magenta-light text-disney-magenta font-medium hover:bg-disney-pink-pale/50 transition bg-white/80"
        >
          {FiLogOut ? <FiLogOut className="w-5 h-5" /> : <span>⎋</span>}
          ออกจากระบบ (Log out)
        </button>
      </main>
    </div>
  )
}
