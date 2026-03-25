import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase-server'
import {
  isMissingSupabaseServerEnv,
  nextMisconfiguredSimple,
} from '@/lib/supabase-env-error'

const TOKEN_VALID_MINUTES = 5
/** ราคาต่อชิ้น (บาท) — ขั้นต่ำ 1 ชิ้น = 10 บาท; จำนวนสูงสุด = floor(credit/10) ชิ้น */
const PRICE_PER_UNIT = 10
const MIN_QUANTITY = 1

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * สร้างโทเค็นสำหรับ Dynamic QR (ต้องส่ง Authorization: Bearer <access_token>)
 * โทเค็นหมดอายุใน 5 นาที และใช้ได้ครั้งเดียวเมื่อตู้กดเรียก validate
 *
 * Body: { refresh_token?, amount } — amount = ยอดเงินรวม (จำนวนชิ้น × 10) ต้องตรงกับที่ส่ง validate
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    let body: { refresh_token?: string; amount?: unknown } = {}
    try {
      body = await request.json().catch(() => ({}))
    } catch {
      // no body
    }
    const refreshToken = body.refresh_token ?? ''
    const rawAmount = body.amount
    const purchaseAmount =
      typeof rawAmount === 'string'
        ? roundMoney(parseFloat(rawAmount.replace(/,/g, '').trim()))
        : typeof rawAmount === 'number'
          ? roundMoney(rawAmount)
          : NaN
    if (!Number.isFinite(purchaseAmount)) {
      return NextResponse.json(
        { error: 'amount is required and must be a number (total purchase in THB)' },
        { status: 400 }
      )
    }

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

    const serverSupabase = createServerSupabase()

    const { data: member, error: memErr } = await serverSupabase
      .from('vending_member')
      .select('credit')
      .eq('id', userId)
      .maybeSingle()

    if (memErr) {
      console.error('qr-token member read error:', memErr)
      return NextResponse.json({ error: memErr.message }, { status: 500 })
    }

    const credit = roundMoney(
      member?.credit != null ? Number(member.credit) : 0
    )
    const maxQty = Math.floor(credit / PRICE_PER_UNIT)
    const maxAmount = maxQty * PRICE_PER_UNIT
    const minAmount = MIN_QUANTITY * PRICE_PER_UNIT

    if (maxQty < MIN_QUANTITY) {
      return NextResponse.json(
        {
          error: 'Insufficient credit for minimum order (need at least 10 THB for 1 item)',
          code: 'insufficient_for_minimum',
          credit,
          minAmount,
          maxAmount: maxQty * PRICE_PER_UNIT,
        },
        { status: 402 }
      )
    }

    if (
      purchaseAmount < minAmount - 1e-9 ||
      purchaseAmount > maxAmount + 1e-9
    ) {
      return NextResponse.json(
        {
          error: 'amount out of range for current credit',
          code: 'invalid_amount',
          amount: purchaseAmount,
          minAmount,
          maxAmount,
        },
        { status: 400 }
      )
    }

    const qty = Math.round(purchaseAmount / PRICE_PER_UNIT)
    if (
      qty < MIN_QUANTITY ||
      qty > maxQty ||
      Math.abs(qty * PRICE_PER_UNIT - purchaseAmount) > 1e-6
    ) {
      return NextResponse.json(
        {
          error: `amount must be a multiple of ${PRICE_PER_UNIT} between ${minAmount} and ${maxAmount}`,
          code: 'invalid_amount_step',
          minAmount,
          maxAmount,
        },
        { status: 400 }
      )
    }

    const lockedAmount = roundMoney(qty * PRICE_PER_UNIT)
    const expiresAt = new Date(Date.now() + TOKEN_VALID_MINUTES * 60 * 1000)
    const { data: row, error } = await serverSupabase
      .from('vending_qr_tokens')
      .insert({
        user_id: userId,
        expires_at: expiresAt.toISOString(),
        expected_amount: lockedAmount,
      })
      .select('token, expires_at')
      .single()

    if (error) {
      console.error('qr-token insert error:', error)
      const isTableMissing = error.code === '42P01' || error.message?.includes('does not exist')
      const isMissingExpectedAmountCol =
        error.message?.includes('expected_amount') &&
        (error.message?.includes('does not exist') || error.code === '42703')
      return NextResponse.json(
        {
          error: isTableMissing
            ? 'Table vending_qr_tokens not found. Run supabase/vending_qr_tokens_migration.sql in Supabase SQL Editor.'
            : isMissingExpectedAmountCol
              ? 'Column expected_amount missing. Run supabase/vending_qr_tokens_expected_amount.sql in Supabase SQL Editor.'
              : 'Failed to create token',
          code: isTableMissing
            ? 'table_missing'
            : isMissingExpectedAmountCol
              ? 'column_missing'
              : 'insert_error',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      token: row.token,
      expiresAt: row.expires_at,
      amount: lockedAmount,
      quantity: qty,
    })
  } catch (e) {
    console.error('qr-token error:', e)
    if (isMissingSupabaseServerEnv(e)) return nextMisconfiguredSimple()
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
