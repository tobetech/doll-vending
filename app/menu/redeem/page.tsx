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
    const hang = setTimeout(() => setLoading(false), 15_000)
    void Promise.resolve(
      supabase.from('vending_member').select('point').eq('id', user.id).maybeSingle()
    )
      .then(({ data }) => {
        setPoints(Number(data?.point) ?? 0)
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(hang)
        setLoading(false)
      })
  }, [user?.id])

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
          <h1 className="text-lg font-bold text-disney-magenta">แลกคะแนน</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 relative">
        <section className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border-2 border-disney-magenta-light p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-disney-magenta-soft flex items-center justify-center border-2 border-disney-magenta-light">
              <FiGift className="text-disney-magenta w-6 h-6" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">คะแนนสะสมของคุณ</h2>
              <p className="text-2xl font-bold text-disney-magenta">{points} คะแนน</p>
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
