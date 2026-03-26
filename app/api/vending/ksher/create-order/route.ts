import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServerSupabase } from '@/lib/supabase-server'
import {
  isMissingSupabaseServerEnv,
  nextMisconfiguredSimple,
} from '@/lib/supabase-env-error'
import { resolveUserIdFromBearer } from '@/lib/auth-resolve-user-id'
import {
  bahtToKsherAmount,
  createKsherCscanb,
  isKsherConfigured,
  parseKsherCreateResponse,
} from '@/lib/ksher-cscanb'

const MIN_BAHT = 1
const MAX_BAHT = 500_000

function formatKsherCreateError(e: unknown): string {
  const raw =
    e && typeof e === 'object' && 'response' in e
      ? String((e as { response?: { data?: unknown } }).response?.data ?? e)
      : e instanceof Error
        ? e.message
        : 'Ksher orderCreate failed'

  const lower = raw.toLowerCase()
  if (lower.includes('<html') || raw.includes('没有此链接') || lower.includes('no such link')) {
    return 'Ksher endpoint not found. Please verify KSHER_HOST is correct for your account (sandbox/production) and that C-scan-B API is enabled.'
  }

  return raw
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    if (!isKsherConfigured()) {
      return NextResponse.json(
        {
          error:
            'Ksher is not configured. Set KSHER_HOST and KSHER_TOKEN in environment variables.',
          code: 'ksher_not_configured',
        },
        { status: 503 }
      )
    }

    let body: { refresh_token?: string; amount?: unknown } = {}
    try {
      body = await request.json().catch(() => ({}))
    } catch {
      // no body
    }
    const refreshToken = body.refresh_token ?? ''
    const amountBaht = Number(body.amount)
    if (!Number.isFinite(amountBaht) || amountBaht < MIN_BAHT || amountBaht > MAX_BAHT) {
      return NextResponse.json(
        { error: `amount must be between ${MIN_BAHT} and ${MAX_BAHT} THB` },
        { status: 400 }
      )
    }

    const userId = await resolveUserIdFromBearer(accessToken, refreshToken)
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired session', code: 'session_invalid' },
        { status: 401 }
      )
    }

    const amountKsher = bahtToKsherAmount(amountBaht)
    const supabase = createServerSupabase()
    // ฝังข้อมูลตามที่ต้องการลงใน merchant_order_id (reference ของ Ksher)
    // เพื่อให้ข้อมูล { userID, action:"topup", amount } ถูกเก็บ/อ้างอิงได้ผ่าน merchant_order_id
    const action = 'topup'
    const userIdCompact = userId.replace(/-/g, '')
    // เก็บเป็น "satang" (บาท*100) เพื่อหลีกเลี่ยงจุดทศนิยมใน id
    const amountCents = Math.round(amountBaht * 100)
    const randShort = randomUUID().replace(/-/g, '').slice(0, 8)
    const merchantOrderId = `kstu_${action}_${userIdCompact}_${amountCents}_${randShort}`

    const { data: insRow, error: insErr } = await supabase
      .from('ksher_topup_orders')
      .insert({
        user_id: userId,
        merchant_order_id: merchantOrderId,
        amount_baht: amountBaht,
        amount_ksher: amountKsher,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insErr) {
      console.error('ksher create-order db insert:', insErr)
      const missing =
        insErr.message?.includes('ksher_topup_orders') ||
        insErr.code === '42P01'
      return NextResponse.json(
        {
          error: missing
            ? 'Table ksher_topup_orders not found. Run supabase/ksher_topup_orders_migration.sql in Supabase SQL Editor.'
            : insErr.message,
          code: missing ? 'table_missing' : 'insert_error',
        },
        { status: 500 }
      )
    }

    const sdk = createKsherCscanb()
    const timestamp = String(Date.now())
    try {
      const ksherRes = await sdk.orderCreate({
        note: `Doll Vending topup ${amountBaht} THB`,
        channel: 'promptpay',
        timestamp,
        amount: amountKsher,
        merchant_order_id: merchantOrderId,
      })

      const parsed = parseKsherCreateResponse(ksherRes)
      const qrBase64 = parsed.reserved1
      await supabase
        .from('ksher_topup_orders')
        .update({
          create_response: parsed.raw as unknown as Record<string, unknown>,
          ksher_instance: parsed.instance ?? null,
        })
        .eq('id', insRow.id)

      if (!qrBase64) {
        console.warn('ksher create-order: no reserved1 in response', ksherRes)
        await supabase
          .from('ksher_topup_orders')
          .update({ status: 'failed' })
          .eq('id', insRow.id)
        return NextResponse.json(
          {
            error: 'Ksher did not return QR data (reserved1 empty). Check sandbox/production credentials.',
            code: 'ksher_no_qr',
            merchantOrderId,
          },
          { status: 502 }
        )
      }

      return NextResponse.json({
        merchantOrderId,
        amountBaht,
        qrImageBase64: qrBase64,
      })
    } catch (e: unknown) {
      await supabase
        .from('ksher_topup_orders')
        .update({ status: 'failed' })
        .eq('id', insRow.id)

      const msg = formatKsherCreateError(e)
      console.error('ksher orderCreate error:', e)
      return NextResponse.json(
        { error: msg, code: 'ksher_api_error' },
        { status: 502 }
      )
    }
  } catch (e) {
    console.error('ksher create-order error:', e)
    if (isMissingSupabaseServerEnv(e)) return nextMisconfiguredSimple()
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
