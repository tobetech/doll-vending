import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

const DEFAULT_MS = 12_000

/**
 * กัน getSession() ค้างเมื่อเชื่อมต่อ Supabase ไม่ได้ / URL ผิด — หลังหมดเวลาถือว่าไม่มี session
 */
export async function getSessionWithTimeout(ms = DEFAULT_MS): Promise<{
  session: Session | null
  timedOut: boolean
}> {
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), ms)
  })
  const result = await Promise.race([supabase.auth.getSession(), timeoutPromise])
  if (result === null) {
    return { session: null, timedOut: true }
  }
  return { session: result.data.session ?? null, timedOut: false }
}
