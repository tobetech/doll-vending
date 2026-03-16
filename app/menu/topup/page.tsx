'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { FiArrowLeft, FiCreditCard } from 'react-icons/fi'
import DisneyBackground from '@/app/components/DisneyBackground'

export default function TopUpPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session?.user) {
        router.push('/login')
        return
      }
      setUser({ id: data.session.user.id })
    })
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    const num = parseFloat(amount.replace(/,/g, ''))
    if (!Number.isFinite(num) || num <= 0) {
      setMessage({ type: 'err', text: 'กรุณาระบุจำนวนเงินที่ถูกต้อง' })
      return
    }
    setLoading(true)
    setMessage(null)
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('balance, points')
      .eq('user_id', user.id)
      .single()
    const currentBalance = Number(existing?.balance) || 0
    const newBalance = currentBalance + num
    const { error } = await supabase
      .from('user_profiles')
      .upsert(
        {
          user_id: user.id,
          balance: newBalance,
          points: existing?.points ?? 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
    setLoading(false)
    if (error) {
      setMessage({ type: 'err', text: error.message })
      return
    }
    setMessage({ type: 'ok', text: `เติมเงิน ${num.toFixed(2)} บาท สำเร็จ` })
    setAmount('')
  }

  if (!user) {
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
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border-2 border-disney-magenta-light p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-disney-magenta-soft flex items-center justify-center border-2 border-disney-magenta-light">
              <FiCreditCard className="text-disney-magenta w-6 h-6" />
            </div>
            <p className="text-gray-600">กรอกจำนวนเงินที่ต้องการเติม (บาท)</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-disney-magenta-light focus:border-disney-magenta focus:ring-2 focus:ring-disney-magenta-soft outline-none text-lg bg-disney-pink-pale/30"
            />
            {message && (
              <p
                className={`text-sm ${message.type === 'ok' ? 'text-disney-magenta' : 'text-red-600'}`}
              >
                {message.text}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-disney-magenta text-white font-semibold hover:bg-disney-rose disabled:opacity-50 border-2 border-disney-magenta-light"
            >
              {loading ? 'กำลังดำเนินการ...' : 'เติมเงิน'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
