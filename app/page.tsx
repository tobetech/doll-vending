'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import DisneyBackground from '@/app/components/DisneyBackground'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/menu')
      } else {
        router.replace('/login')
      }
    })
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <DisneyBackground />
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-disney-magenta border-t-transparent" />
    </div>
  )
}
