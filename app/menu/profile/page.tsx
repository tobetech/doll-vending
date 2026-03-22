'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getSessionWithTimeout } from '@/lib/get-session-with-timeout'
import { FiArrowLeft, FiUser, FiMail, FiPhone } from 'react-icons/fi'
import DisneyBackground from '@/app/components/DisneyBackground'

/** อนุญาตว่างได้; ถ้ามีค่า ต้องมีตัวเลขอย่างน้อย 9 หลัก (รองรับเบอร์ไทย) */
function isValidTelNo(tel: string): boolean {
  const t = tel.trim()
  if (!t) return true
  const d = t.replace(/\D/g, '')
  return d.length >= 9 && d.length <= 15
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [userName, setUserName] = useState('')
  const [telNo, setTelNo] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

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
      supabase
        .from('vending_member')
        .select('email, user_name, tel_no')
        .eq('id', user.id)
        .maybeSingle()
    )
      .then(({ data, error }) => {
        if (error) {
          setMessage({ type: 'err', text: error.message })
          return
        }
        setEmail(data?.email ?? '')
        setUserName((data?.user_name as string) ?? '')
        setTelNo((data?.tel_no as string) ?? '')
      })
      .catch(() => {
        setMessage({ type: 'err', text: 'โหลดข้อมูลไม่สำเร็จ' })
      })
      .finally(() => {
        clearTimeout(hang)
        setLoading(false)
      })
  }, [user?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    const trimmedName = userName.trim()
    const trimmedTel = telNo.trim()

    if (!isValidTelNo(trimmedTel)) {
      setMessage({
        type: 'err',
        text: 'หมายเลขโทรศัพท์ไม่ถูกต้อง (ต้องมีตัวเลขอย่างน้อย 9 หลัก)',
      })
      return
    }

    setSaving(true)
    setMessage(null)
    const { error } = await supabase
      .from('vending_member')
      .update({
        user_name: trimmedName,
        tel_no: trimmedTel,
      })
      .eq('id', user.id)

    if (error) {
      setMessage({
        type: 'err',
        text:
          error.message.includes('user_name') || error.message.includes('tel_no')
            ? 'ยังไม่มีคอลัมน์ user_name/tel_no ในฐานข้อมูล — รันไฟล์ supabase/vending_member_user_profile.sql ใน Supabase SQL Editor'
            : error.message,
      })
    } else {
      setMessage({ type: 'ok', text: 'บันทึกข้อมูลแล้ว' })
    }
    setSaving(false)
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
          <Link
            href="/menu"
            className="p-2 rounded-lg hover:bg-white/10 text-white"
          >
            <FiArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold">แก้ไขข้อมูลส่วนตัว</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 relative">
        <section className="bg-white rounded-card shadow-card border border-bill-border p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-bill-pale flex items-center justify-center border border-bill-border">
              <FiUser className="text-bill-primary w-6 h-6" />
            </div>
            <h2 className="font-semibold text-gray-800">ข้อมูลสมาชิก</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                <FiUser className="text-bill-primary w-4 h-4" />
                ชื่อ (user_name)
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-4 py-3 rounded-card border border-bill-border bg-bill-pale/50 focus:outline-none focus:border-bill-primary focus:ring-1 focus:ring-bill-primary/30"
                placeholder="ชื่อที่ต้องการแสดง"
                autoComplete="name"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                <FiPhone className="text-bill-primary w-4 h-4" />
                หมายเลขโทรศัพท์ (tel_no)
              </label>
              <input
                type="tel"
                value={telNo}
                onChange={(e) => setTelNo(e.target.value)}
                className="w-full px-4 py-3 rounded-card border border-bill-border bg-bill-pale/50 focus:outline-none focus:border-bill-primary focus:ring-1 focus:ring-bill-primary/30"
                placeholder="เช่น 0812345678"
                autoComplete="tel"
                inputMode="tel"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                <FiMail className="text-bill-primary w-4 h-4" />
                อีเมล <span className="text-xs font-normal text-gray-500">(แสดงผลเท่านั้น)</span>
              </label>
              <div
                className="w-full px-4 py-3 rounded-card border border-bill-border bg-gray-50 text-gray-700 break-all"
                aria-readonly
              >
                {email || '—'}
              </div>
            </div>

            {message && (
              <p
                className={`text-sm ${message.type === 'ok' ? 'text-green-600' : 'text-bill-danger'}`}
              >
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-bill-primary text-white rounded-card font-semibold border border-bill-blueDark/30 hover:opacity-95 disabled:opacity-50"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}
