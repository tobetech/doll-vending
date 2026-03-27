import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import {
  isMissingSupabaseServerEnv,
  nextMisconfiguredWebhook,
} from '@/lib/supabase-env-error'
import { isUuidString } from '@/lib/is-uuid'

/**
 * เรียกจากตู้เมื่อ POST /api/vending/validate ไม่สำเร็จ (หลังสแกน QR ซื้อของ)
 * บันทึก vending_transactions สถานะ failed → แอปรับ realtime แล้วแสดงข้อความ Error
 *
 * Body: { token, machineId?, transactionId? } — token เดียวกับใน QR (ใช้หา user_id)
 */
export async function POST(request: NextRequest) {
  try {
    const raw = await request.json().catch(() => ({}))
    const rec =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {}

    const token =
      (typeof rec.token === 'string' && rec.token.trim()) ||
      (typeof rec.Token === 'string' && rec.Token.trim()) ||
      (typeof rec.token_id === 'string' && rec.token_id.trim()) ||
      ''

    const machineId =
      (typeof rec.machine_id === 'string' && rec.machine_id.trim()) ||
      (typeof rec.machineId === 'string' && rec.machineId.trim()) ||
      'unknown-machine'

    const transactionId =
      typeof rec.transaction_id === 'string'
        ? rec.transaction_id.trim()
        : typeof rec.transactionId === 'string'
          ? rec.transactionId.trim()
          : undefined

    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'token is required' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()

    const { data: tokRow, error: tokErr } = await supabase
      .from('vending_qr_tokens')
      .select('user_id')
      .eq('token', token)
      .maybeSingle()

    if (tokErr) {
      console.error('vending-validate-error token lookup:', tokErr)
      return NextResponse.json(
        { ok: false, error: tokErr.message },
        { status: 500 }
      )
    }

    if (!tokRow?.user_id) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Token not found — cannot notify user',
          code: 'token_not_found',
        },
        { status: 404 }
      )
    }

    const userId = tokRow.user_id as string
    const DISPLAY_MESSAGE = 'เกิดข้อผิดพลาด (Error)'

    const baseInsert: Record<string, unknown> = {
      user_id: userId,
      machine_id: machineId,
      product_id: 'validate_error',
      product_name: DISPLAY_MESSAGE,
      amount: 0,
      status: 'failed',
    }
    if (transactionId && isUuidString(transactionId)) {
      baseInsert.id = transactionId.trim()
    }

    const { data: row, error: insErr } = await supabase
      .from('vending_transactions')
      .insert(baseInsert)
      .select('id, created_at')
      .single()

    if (insErr) {
      console.error('vending-validate-error insert:', insErr)
      return NextResponse.json(
        { ok: false, error: insErr.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      transactionId: row?.id,
      createdAt: row?.created_at,
      userId,
    })
  } catch (e) {
    console.error('vending-validate-error:', e)
    if (isMissingSupabaseServerEnv(e)) return nextMisconfiguredWebhook()
    return NextResponse.json(
      { ok: false, error: 'Server error' },
      { status: 500 }
    )
  }
}
