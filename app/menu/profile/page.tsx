'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { FiArrowLeft, FiUser, FiMail } from 'react-icons/fi'
import DisneyBackground from '@/app/components/DisneyBackground'

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('vending_member')
      .select('email')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setEmail(data?.email ?? '')
        setLoading(false)
      })
  }, [user?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    const trimmed = email.trim()
    if (!trimmed) {
      setMessage({ type: 'err', text: 'กรุณาระบุอีเมล' })
      return
    }
    setSaving(true)
    setMessage(null)
    const { error } = await supabase
      .from('vending_member')
      .update({ email: trimmed })
      .eq('id', user.id)
    if (error) {
      setMessage({ type: 'err', text: error.message })
    } else {
      setMessage({ type: 'ok', text: 'บันทึกข้อมูลแล้ว' })
    }
    setSaving(false)
  }

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
          <h1 className="text-lg font-bold text-disney-magenta">แก้ไขข้อมูลส่วนตัว</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 relative">
        <section className="bg-white/95 backdrop-blur rounded-2xl shadow-lg border-2 border-disney-magenta-light p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-disney-magenta-soft flex items-center justify-center border-2 border-disney-magenta-light">
              <FiUser className="text-disney-magenta w-6 h-6" />
            </div>
            <h2 className="font-semibold text-gray-800">ข้อมูลสมาชิก</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                <FiMail className="text-disney-magenta w-4 h-4" />
                อีเมล
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-disney-magenta-light bg-disney-pink-pale/30 focus:outline-none focus:border-disney-magenta"
                placeholder="your@email.com"
              />
            </div>

            {message && (
              <p
                className={`text-sm ${message.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}
              >
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-disney-magenta text-white rounded-xl font-semibold border-2 border-disney-magenta-light hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}
