import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase-server'
import {
  isMissingSupabaseServerEnv,
  nextMisconfiguredSimple,
} from '@/lib/supabase-env-error'

const TOKEN_VALID_MINUTES = 2

/** สร้างโทเค็นเติมเงิน → บันทึกใน vending_topup_token (รอตู้สแกน) */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    let body: { refresh_token?: string } = {}
    try {
      body = await request.json().catch(() => ({}))
    } catch {
      // no body
    }
    const refreshToken = body.refresh_token ?? ''

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
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired session', code: 'session_invalid' },
        { status: 401 }
      )
    }

    const expiresAt = new Date(Date.now() + TOKEN_VALID_MINUTES * 60 * 1000)
    const serverSupabase = createServerSupabase()
    const { data: row, error } = await serverSupabase
      .from('vending_topup_token')
      .insert({
        user_id: userId,
        expires_at: expiresAt.toISOString(),
        status: 'pending',
      })
      .select('token, expires_at')
      .single()

    if (error) {
      console.error('topup-qr-token insert error:', error)
      const isTableMissing = error.code === '42P01' || error.message?.includes('does not exist')
      return NextResponse.json(
        {
          error: isTableMissing
            ? 'Table vending_topup_token not found. Run supabase/vending_topup_token_migration.sql in Supabase SQL Editor.'
            : 'Failed to create token',
          code: isTableMissing ? 'table_missing' : 'insert_error',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      token: row.token,
      expiresAt: row.expires_at,
    })
  } catch (e) {
    console.error('topup-qr-token error:', e)
    if (isMissingSupabaseServerEnv(e)) return nextMisconfiguredSimple()
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
