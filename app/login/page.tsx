'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FiMail, FiLock, FiArrowRight } from 'react-icons/fi'
import DisneyBackground from '@/app/components/DisneyBackground'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    if (mode === 'signup' && password !== confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน')
      setLoading(false)
      return
    }
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push('/menu')
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        if (data?.user) {
          await supabase
            .from('vending_member')
            .upsert(
              { id: data.user.id, email: data.user.email ?? email },
              { onConflict: 'id' }
            )
        }
        setMode('signin')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 relative overflow-y-auto">
      <DisneyBackground />
      <div className="flex-1 flex items-start justify-center pt-[max(1.5rem,env(safe-area-inset-top))] pb-12 w-full max-w-md">
        <div className="bg-white/95 backdrop-blur w-full rounded-3xl shadow-2xl p-8 border-2 border-disney-magenta-light shrink-0">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-disney-magenta-soft flex items-center justify-center shadow-lg border-2 border-disney-magenta-light">
            <FiArrowRight className="text-disney-magenta text-2xl" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-disney-magenta mb-2">
          {mode === 'signin' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
        </h2>
        <p className="text-center text-gray-600 mb-6">
          กรุณาเข้าสู่ระบบเพื่อซื้อจากตู้กด
        </p>
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700">อีเมล</label>
          <div className="flex items-center mt-1 bg-disney-pink-pale/50 border-2 border-disney-magenta-light rounded-xl px-3">
            <FiMail className="text-disney-magenta/70" />
            <input
              type="email"
              className="w-full bg-transparent px-2 py-3 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700">รหัสผ่าน</label>
          <div className="flex items-center mt-1 bg-disney-pink-pale/50 border-2 border-disney-magenta-light rounded-xl px-3">
            <FiLock className="text-disney-magenta/70" />
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
            <div className="flex items-center mt-1 bg-disney-pink-pale/50 border-2 border-disney-magenta-light rounded-xl px-3">
              <FiLock className="text-disney-magenta/70" />
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
          <div className="text-center text-red-500 text-sm mb-4">{error}</div>
        )}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full mt-2 bg-disney-magenta text-white py-3 rounded-xl font-semibold shadow-lg hover:bg-disney-rose transition border-2 border-disney-magenta-light"
        >
          {loading ? 'กำลังดำเนินการ...' : mode === 'signin' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
        </button>
        <button
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="w-full text-center text-sm text-disney-magenta font-medium mt-4"
        >
          {mode === 'signin' ? 'ยังไม่มีบัญชี? สมัครสมาชิก' : 'มีบัญชีแล้ว? เข้าสู่ระบบ'}
        </button>
        </div>
      </div>
    </div>
  )
}
