import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

/**
 * ตู้กดเรียกพร้อม token (จาก Dynamic QR) หรือ userId (แบบเก่า)
 * รองรับ: Body { token: string } หรือ { userId: string }
 * token ใช้ได้ครั้งเดียว และต้องไม่หมดอายุ
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { token?: string; userId?: string; machineId?: string; productId?: string }
    const { token, userId: bodyUserId } = body

    const supabase = createServerSupabase()

    // กรณีส่ง token (Dynamic QR) — ใช้ครั้งเดียว
    if (token && typeof token === 'string') {
      const now = new Date().toISOString()
      const { data: row, error } = await supabase
        .from('vending_qr_tokens')
        .select('user_id')
        .eq('token', token)
        .gt('expires_at', now)
        .is('used_at', null)
        .single()

      if (error || !row) {
        return NextResponse.json(
          { success: false, error: 'Token invalid, expired or already used' },
          { status: 404 }
        )
      }

      await supabase
        .from('vending_qr_tokens')
        .update({ used_at: now })
        .eq('token', token)

      const { data: userData } = await supabase.auth.admin.getUserById(row.user_id)
      const user = userData?.user
      return NextResponse.json({
        success: true,
        userId: row.user_id,
        email: user?.email ?? undefined,
      })
    }

    // กรณีส่ง userId (แบบเก่า)
    if (!bodyUserId || typeof bodyUserId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'token or userId is required' },
        { status: 400 }
      )
    }

    const { data: user, error } = await supabase.auth.admin.getUserById(bodyUserId)
    if (error || !user?.user) {
      return NextResponse.json(
        { success: false, error: 'User not found or invalid' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      userId: user.user.id,
      email: user.user.email ?? undefined,
    })
  } catch (e) {
    console.error('Vending validate error:', e)
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    )
  }
}
