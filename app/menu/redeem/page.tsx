'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getSessionWithTimeout } from '@/lib/get-session-with-timeout'
import { FiArrowLeft, FiGift } from 'react-icons/fi'
import DisneyBackground from '@/app/components/DisneyBackground'

export default function RedeemPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [points, setPoints] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSessionWithTimeout()
      .then(({ session }) => {
        if (!session?.user) {
          setLoading(false)
          router.replace('/login')
          return
        }
        setUser({ id: session.user.id })
      })
      .catch(() => {
        setLoading(false)
        router.replace('/login')
      })
  }, [router])

  useEffect(() => {
    if (!user?.id) return
    const uid = user.id
    const hang = setTimeout(() => setLoading(false), 15_000)
    void Promise.resolve(
      supabase.from('vending_member').select('point').eq('id', uid).maybeSingle()
    )
      .then(({ data }) => {
        const pt = data?.point != null && data.point !== '' ? Number(data.point) : 0
        setPoints(Number.isFinite(pt) ? pt : 0)
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(hang)
        setLoading(false)
      })
    const channel = supabase
      .channel(`redeem_member_${uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vending_member',
          filter: `id=eq.${uid}`,
        },
        (payload) => {
          const row = payload.new as { point?: unknown } | null
          const pt = row?.point != null && row.point !== '' ? Number(row.point) : 0
          setPoints(Number.isFinite(pt) ? pt : 0)
        }
      )
      .subscribe()

    return () => {
      clearTimeout(hang)
      supabase.removeChannel(channel)
    }
  }, [user?.id])

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
          <Link
            href="/menu"
            className="p-2 rounded-lg hover:bg-white/10 text-white"
          >
            <FiArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold">แลกคะแนน</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 relative">
        <section className="bg-white rounded-card shadow-card border border-bill-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-bill-pale flex items-center justify-center border border-bill-border">
              <FiGift className="text-bill-primary w-6 h-6" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">คะแนนสะสมของคุณ</h2>
              <p className="text-2xl font-bold text-bill-gold">{points} คะแนน</p>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            หน้านี้ใช้แลกคะแนนสะสมเป็นของรางวัล (กำลังพัฒนา)
          </p>
        </section>
      </main>
    </div>
  )
}
