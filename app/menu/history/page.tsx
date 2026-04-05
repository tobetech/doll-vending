'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getSessionWithTimeout } from '@/lib/get-session-with-timeout'
import type { VendingTransaction } from '@/lib/types'
import { FiArrowLeft } from 'react-icons/fi'
import DisneyBackground from '@/app/components/DisneyBackground'

export default function HistoryPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [list, setList] = useState<VendingTransaction[]>([])
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
      supabase
        .from('vending_transactions')
        .select('id, machine_id, product_name, amount, status, created_at, credit_after')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)
    )
      .then(({ data, error }) => {
        if (!error) setList((data as VendingTransaction[]) ?? [])
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(hang)
        setLoading(false)
      })
  }, [user?.id])

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(n)
  const formatDate = (s: string) =>
    new Date(s).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })

  if (!user) {
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
          <h1 className="text-2xl sm:text-xl font-bold">ประวัติการใช้งาน</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 relative">
        <div className="bg-white rounded-card shadow-card border border-bill-border overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-lg text-gray-500">กำลังโหลด...</div>
          ) : list.length === 0 ? (
            <div className="py-12 text-center text-lg text-gray-500">
              ยังไม่มีประวัติการใช้งาน
            </div>
          ) : (
            <ul className="divide-y divide-bill-border">
              {list.map((tx) => (
                <li key={tx.id} className="px-4 py-4 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-medium text-gray-800">
                      {tx.product_name || 'สินค้า'}
                    </p>
                    <p className="text-sm text-gray-500">
                      ตู้ {tx.machine_id} · {formatDate(tx.created_at)}
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-bill-blue shrink-0 tabular-nums">
                    {formatCurrency(Number(tx.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
