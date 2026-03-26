import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import {
  isMissingSupabaseServerEnv,
  nextMisconfiguredValidate,
} from '@/lib/supabase-env-error'

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * ตู้กดเรียกพร้อม token (จาก Dynamic QR) หรือ userId (แบบเก่า)
 * รองรับ: Body { token: string } หรือ { userId: string }
 * token ใช้ได้ครั้งเดียว และต้องไม่หมดอายุ
 *
 * Dynamic QR ที่ล็อกยอด: ส่ง { token, amount } โดย amount ต้องตรงกับตอนสร้าง token (ยอดรวมบาท)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      token?: string
      userId?: string
      userID?: string
      machineId?: string
      productId?: string
      amount?: unknown
    }
    const token = typeof body.token === 'string' ? body.token : undefined
    const bodyUserId =
      (typeof body.userId === 'string' && body.userId) ||
      (typeof body.userID === 'string' && body.userID) ||
      undefined

    const supabase = createServerSupabase()

    // กรณีส่ง token (Dynamic QR) — ใช้ครั้งเดียว
    if (token && typeof token === 'string') {
      const now = new Date().toISOString()
      const { data: row, error } = await supabase
        .from('vending_qr_tokens')
        .select('user_id, expected_amount')
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

      const lockedRaw = (row as { expected_amount?: unknown }).expected_amount
      const locked =
        lockedRaw != null && lockedRaw !== ''
          ? roundMoney(Number(lockedRaw))
          : null

      if (locked != null && locked > 0) {
        const rawAmt = body.amount
        const bodyAmount =
          typeof rawAmt === 'string'
            ? roundMoney(parseFloat(rawAmt.replace(/,/g, '').trim()))
            : typeof rawAmt === 'number'
              ? roundMoney(rawAmt)
              : NaN
        if (!Number.isFinite(bodyAmount) || Math.abs(bodyAmount - locked) > 0.009) {
          return NextResponse.json(
            {
              success: false,
              error: 'amount is required and must match locked purchase total',
              expectedAmount: locked,
            },
            { status: 400 }
          )
        }
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
        ...(locked != null && locked > 0 ? { amount: locked } : {}),
      })
    }

    // กรณีส่ง userId (แบบเก่า)
    if (!bodyUserId) {
      return NextResponse.json(
        { success: false, error: 'token or userId/userID is required' },
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
    if (isMissingSupabaseServerEnv(e)) return nextMisconfiguredValidate()
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    )
  }
}
