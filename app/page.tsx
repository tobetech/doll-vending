'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionWithTimeout } from '@/lib/get-session-with-timeout'
import DisneyBackground from '@/app/components/DisneyBackground'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    getSessionWithTimeout().then(({ session }) => {
      if (session) {
        router.replace('/menu')
      } else {
        router.replace('/login')
      }
    })
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center relative bg-white">
      <DisneyBackground />
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-bill-primary border-t-transparent" />
    </div>
  )
}
