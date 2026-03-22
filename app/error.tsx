'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 bg-bill-pale text-gray-800">
      <h1 className="text-xl font-bold text-bill-primary">เกิดข้อผิดพลาด</h1>
      <p className="text-sm text-center max-w-md">{error.message || 'ไม่สามารถแสดงหน้านี้ได้'}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="px-5 py-2.5 bg-bill-primary text-white rounded-card font-semibold shadow-md"
      >
        ลองอีกครั้ง
      </button>
    </div>
  )
}
