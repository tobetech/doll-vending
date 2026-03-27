'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FiLock, FiArrowRight, FiUser, FiPhone } from 'react-icons/fi'
import DisneyBackground from '@/app/components/DisneyBackground'

function normalizePhoneForAuth(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  const hasPlus = t.startsWith('+')
  const digits = t.replace(/\D/g, '')
  if (!digits) return ''

  // รองรับรูปแบบไทยที่พิมพ์ 0xxxxxxxxx -> +66xxxxxxxxx
  if (!hasPlus && digits.length === 10 && digits.startsWith('0')) {
    return `+66${digits.slice(1)}`
  }
  // รองรับ 66xxxxxxxxx -> +66xxxxxxxxx
  if (!hasPlus && digits.length === 11 && digits.startsWith('66')) {
    return `+${digits}`
  }
  // ถ้าใส่ + มาอยู่แล้ว เก็บตามรูปแบบ E.164
  if (hasPlus) return `+${digits}`
  // fallback: เพิ่ม + ให้เป็น E.164
  return `+${digits}`
}

function isValidPhoneE164(phone: string): boolean {
  return /^\+[1-9]\d{8,14}$/.test(phone)
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [identifier, setIdentifier] = useState('')
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    if (mode === 'signup') {
      if (!userName.trim()) {
        setError('กรุณากรอกชื่อ')
        setLoading(false)
        return
      }
      if (password !== confirmPassword) {
        setError('รหัสผ่านไม่ตรงกัน')
        setLoading(false)
        return
      }
    }
    const rawId = identifier.trim()
    const isEmail = rawId.includes('@')
    const phoneE164 = isEmail ? '' : normalizePhoneForAuth(rawId)
    const email = isEmail ? rawId : ''

    if (!email && !phoneE164) {
      setError('กรุณากรอกอีเมลหรือหมายเลขโทรศัพท์')
      setLoading(false)
      return
    }
    if (!isEmail && !isValidPhoneE164(phoneE164)) {
      setError('กรุณากรอกหมายเลขโทรศัพท์ให้ถูกต้อง (เช่น +66812345678 หรือ 0812345678)')
      setLoading(false)
      return
    }
    if (mode === 'signin') {
      const { data, error } = await supabase.auth.signInWithPassword({
        ...(email ? { email } : { phone: phoneE164 }),
        password,
      })
      if (error) {
        setError(error.message)
      } else if (data.user) {
        router.push('/menu')
      } else {
        setError('เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง')
      }
    } else {
      const trimmedName = userName.trim()
      const { data, error } = await supabase.auth.signUp({
        ...(email ? { email } : { phone: phoneE164 }),
        password,
        options: {
          data: {
            full_name: trimmedName,
          },
        },
      })
      if (error) {
        setError(error.message)
      } else {
        if (data?.user) {
          const { error: memErr } = await supabase.from('vending_member').upsert(
            {
              id: data.user.id,
              email: data.user.email ?? (email || `${phoneE164}@phone.local`),
              user_name: trimmedName,
              tel_no: phoneE164 || '',
            },
            { onConflict: 'id' }
          )
          if (memErr) {
            setError(
              memErr.message.includes('user_name')
                ? 'ฐานข้อมูลยังไม่มีคอลัมน์ user_name — รัน supabase/vending_member_user_profile.sql'
                : memErr.message
            )
            setLoading(false)
            return
          }
        }
        setUserName('')
        setMode('signin')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 relative overflow-y-auto bg-white">
      <DisneyBackground />
      <div className="w-full max-w-md bg-bill-primary text-white py-4 px-4 text-center shadow-md">
        <p className="text-lg font-bold">Doll Vending</p>
        <p className="text-sm text-white/85">เข้าสู่ระบบเพื่อใช้งานแอป</p>
      </div>
      <div className="flex-1 flex items-start justify-center pt-6 pb-12 w-full max-w-md">
        <div className="bg-white w-full rounded-card shadow-card p-8 border border-bill-border shrink-0">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-bill-pale flex items-center justify-center shadow-inner border border-bill-border">
            <FiArrowRight className="text-bill-primary text-2xl" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-bill-primary mb-2">
          {mode === 'signin' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
        </h2>
        <p className="text-center text-gray-600 mb-6">
          กรุณาเข้าสู่ระบบเพื่อซื้อจากตู้กด
        </p>
        {mode === 'signup' && (
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700">ชื่อ</label>
            <div className="flex items-center mt-1 bg-bill-pale/80 border border-bill-border rounded-card px-3">
              <FiUser className="text-bill-primary/70 shrink-0" />
              <input
                type="text"
                className="w-full bg-transparent px-2 py-3 outline-none"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="ชื่อที่แสดงในแอป"
                autoComplete="name"
              />
            </div>
          </div>
        )}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700">อีเมล หรือ หมายเลขโทรศัพท์</label>
          <div className="flex items-center mt-1 bg-bill-pale/80 border border-bill-border rounded-card px-3">
            <FiPhone className="text-bill-primary/70" />
            <input
              type="text"
              className="w-full bg-transparent px-2 py-3 outline-none"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="example@mail.com หรือ 0812345678"
              autoComplete="username"
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700">รหัสผ่าน</label>
          <div className="flex items-center mt-1 bg-bill-pale/80 border border-bill-border rounded-card px-3">
            <FiLock className="text-bill-primary/70" />
            <input
              type="password"
              className="w-full bg-transparent px-2 py-3 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        {mode === 'signup' && (
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700">ยืนยันรหัสผ่าน</label>
            <div className="flex items-center mt-1 bg-bill-pale/80 border border-bill-border rounded-card px-3">
              <FiLock className="text-bill-primary/70" />
              <input
                type="password"
                className="w-full bg-transparent px-2 py-3 outline-none"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
        )}
        {error && (
          <div className="text-center text-bill-danger text-sm mb-4">{error}</div>
        )}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full mt-2 bg-bill-primary text-white py-3 rounded-card font-semibold shadow-md hover:opacity-95 transition border border-bill-blueDark/30"
        >
          {loading ? 'กำลังดำเนินการ...' : mode === 'signin' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
        </button>
        <button
          type="button"
          onClick={() => {
            setError('')
            if (mode === 'signup') setUserName('')
            setMode(mode === 'signin' ? 'signup' : 'signin')
          }}
          className="w-full text-center text-sm text-bill-blue font-semibold mt-4"
        >
          {mode === 'signin' ? 'ยังไม่มีบัญชี? สมัครสมาชิก' : 'มีบัญชีแล้ว? เข้าสู่ระบบ'}
        </button>
        </div>
      </div>
    </div>
  )
}
