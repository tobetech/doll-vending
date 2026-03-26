import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import {
  isMissingSupabaseServerEnv,
  nextMisconfiguredWebhook,
} from '@/lib/supabase-env-error'
import { createKsherCscanb, getKsherWebhookVerifyUrl, isKsherConfigured } from '@/lib/ksher-cscanb'
import { completeKsherTopupByMerchantOrderId } from '@/lib/ksher-complete-topup'

function isPaidMessage(message: unknown, code: unknown): boolean {
  const m = typeof message === 'string' ? message.toLowerCase() : ''
  const c = typeof code === 'string' ? code.toLowerCase() : ''
  if (m.includes('paid') || m.includes('success')) return true
  if (c.includes('statuschange') || c.includes('paid')) return true
  return false
}

/**
 * Webhook จาก Ksher — ตั้งค่า URL ใน Ksher ให้ตรงกับ KSHER_WEBHOOK_PUBLIC_URL หรือ NEXT_PUBLIC_APP_URL + /api/webhook/ksher
 */
export async function POST(request: NextRequest) {
  try {
    if (!isKsherConfigured()) {
      return NextResponse.json({ ok: false, error: 'Ksher not configured' }, { status: 503 })
    }

    const raw = await request.json().catch(() => (null as unknown))
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const body = raw as Record<string, unknown>
    const verifyUrl = getKsherWebhookVerifyUrl()
    if (verifyUrl) {
      const sdk = createKsherCscanb()
      try {
        const sigOk = sdk.checkSignature(verifyUrl, body)
        if (!sigOk) {
          console.warn('[webhook/ksher] signature mismatch — check KSHER_WEBHOOK_PUBLIC_URL matches dashboard URL')
          return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 })
        }
      } catch (sigErr) {
        console.error('[webhook/ksher] checkSignature error:', sigErr)
        return NextResponse.json({ ok: false, error: 'Signature verify failed' }, { status: 400 })
      }
    } else {
      console.warn(
        '[webhook/ksher] KSHER_WEBHOOK_PUBLIC_URL / NEXT_PUBLIC_APP_URL empty — verify signature skipped'
      )
    }

    if (!isPaidMessage(body.message, body.code)) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    let merchantOrderId =
      typeof body.merchant_order_id === 'string'
        ? body.merchant_order_id.trim()
        : typeof body.merchantOrderId === 'string'
          ? body.merchantOrderId.trim()
          : ''

    if (!merchantOrderId && body.instance != null) {
      const inst = String(body.instance).trim()
      if (inst.startsWith('kstu_')) {
        merchantOrderId = inst
      } else {
        const supabase = createServerSupabase()
        const { data: row } = await supabase
          .from('ksher_topup_orders')
          .select('merchant_order_id')
          .eq('ksher_instance', inst)
          .eq('status', 'pending')
          .maybeSingle()
        merchantOrderId = (row?.merchant_order_id as string) ?? ''
      }
    }

    if (!merchantOrderId) {
      console.warn('[webhook/ksher] cannot resolve merchant_order_id', body)
      return NextResponse.json(
        { ok: false, error: 'merchant_order_id missing' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()
    const result = await completeKsherTopupByMerchantOrderId(supabase, merchantOrderId)
    if (!result.ok && !result.duplicate) {
      return NextResponse.json(
        { ok: false, error: result.error ?? 'complete failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate ?? false,
      newCredit: result.newCredit,
    })
  } catch (e) {
    console.error('webhook ksher error:', e)
    if (isMissingSupabaseServerEnv(e)) return nextMisconfiguredWebhook()
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
