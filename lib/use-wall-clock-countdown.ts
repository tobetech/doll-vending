'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * นับถอยหลังตามเวลาจริง (นาฬิกา) ไม่พึ่งพาแค่ setInterval ทีละ 1 วินาที
 * — ตอนหน้าจอพัก / แอปเบื้องหลัง บนมือถือ timer มักหยุด แต่ Date.now() ยังเดินต่อ
 * เมื่อกลับมาเปิดหน้าจอจะ sync ให้ตรงกับเวลาที่เหลือจริง
 */
export function useWallClockCountdown(
  active: boolean,
  durationSeconds: number,
  onFire: () => void
): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const endAtRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const firedRef = useRef(false)
  const onFireRef = useRef(onFire)
  onFireRef.current = onFire

  const sync = useCallback(() => {
    const end = endAtRef.current
    if (end == null || firedRef.current) return
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000))
    setSecondsLeft(left)
    if (left <= 0) {
      firedRef.current = true
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      endAtRef.current = null
      setSecondsLeft(0)
      onFireRef.current()
    }
  }, [])

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      endAtRef.current = null
      firedRef.current = false
      setSecondsLeft(null)
      return
    }

    firedRef.current = false
    endAtRef.current = Date.now() + durationSeconds * 1000
    sync()

    intervalRef.current = setInterval(sync, 1000)

    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    const onResume = () => sync()

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onResume)
    window.addEventListener('focus', onResume)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onResume)
      window.removeEventListener('focus', onResume)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [active, durationSeconds, sync])

  return secondsLeft
}
