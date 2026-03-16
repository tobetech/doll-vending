import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase-server'

const TOKEN_VALID_MINUTES = 3

/**
 * สร้างโทเค็นสำหรับ Dynamic QR (ต้องส่ง Authorization: Bearer <access_token>)
 * โทเค็นหมดอายุใน 3 นาที และใช้ได้ครั้งเดียวเมื่อตู้กดเรียก validate
 */
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
      .from('vending_qr_tokens')
      .insert({
        user_id: userId,
        expires_at: expiresAt.toISOString(),
      })
      .select('token, expires_at')
      .single()

    if (error) {
      console.error('qr-token insert error:', error)
      const isTableMissing = error.code === '42P01' || error.message?.includes('does not exist')
      return NextResponse.json(
        {
          error: isTableMissing
            ? 'Table vending_qr_tokens not found. Run supabase/vending_qr_tokens_migration.sql in Supabase SQL Editor.'
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
    console.error('qr-token error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
