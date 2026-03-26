import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase-server'

/** ดึง user id จาก Bearer (รูปแบบเดียวกับ qr-token / topup-qr-token) */
export async function resolveUserIdFromBearer(
  accessToken: string,
  refreshToken: string
): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const authClient = createClient(supabaseUrl, supabaseAnonKey)

  let userId: string | null = null
  const { data: sessionData, error: sessionError } = await authClient.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken || '',
  })
  if (!sessionError && sessionData?.user) {
    userId = sessionData.user.id
  }
  if (!userId) {
    try {
      const parts = accessToken.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(
          Buffer.from(parts[1], 'base64url').toString('utf8')
        ) as { sub?: string }
        if (payload.sub) {
          const serverSupabase = createServerSupabase()
          const { data } = await serverSupabase.auth.admin.getUserById(payload.sub)
          if (data?.user) userId = data.user.id
        }
      }
    } catch {
      // ignore
    }
  }
  return userId
}
