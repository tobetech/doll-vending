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
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700">อีเมล</label>
          <div className="flex items-center mt-1 bg-bill-pale/80 border border-bill-border rounded-card px-3">
            <FiMail className="text-bill-primary/70" />
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
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="w-full text-center text-sm text-bill-blue font-semibold mt-4"
        >
          {mode === 'signin' ? 'ยังไม่มีบัญชี? สมัครสมาชิก' : 'มีบัญชีแล้ว? เข้าสู่ระบบ'}
        </button>
        </div>
      </div>
    </div>
  )
}
