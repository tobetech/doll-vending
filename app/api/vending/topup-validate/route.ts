import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import {
  isMissingSupabaseServerEnv,
  nextMisconfiguredValidate,
} from '@/lib/supabase-env-error'

/**
 * ตู้เติมเงิน: ส่ง token จาก QR เพื่อยืนยันและล็อก (pending → locked)
 * หลังลูกค้าใส่จำนวนเงินแล้ว ตู้เรียก POST /api/webhook/vending-topup
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string }
    const token = body.token?.trim()
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'token is required' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()
    const now = new Date().toISOString()

    const { data: updated, error: updError } = await supabase
      .from('vending_topup_token')
      .update({ status: 'locked' })
      .eq('token', token)
      .eq('status', 'pending')
      .gt('expires_at', now)
      .select('user_id')
      .maybeSingle()

    if (updError) {
      console.error('topup-validate update error:', updError)
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      )
    }

    if (!updated?.user_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Token invalid, expired, already used or not pending',
        },
        { status: 404 }
      )
    }

    const { data: userData } = await supabase.auth.admin.getUserById(updated.user_id)
    const user = userData?.user

    return NextResponse.json({
      success: true,
      userId: updated.user_id,
      email: user?.email ?? undefined,
    })
  } catch (e) {
    console.error('topup-validate error:', e)
    if (isMissingSupabaseServerEnv(e)) return nextMisconfiguredValidate()
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    )
  }
}
