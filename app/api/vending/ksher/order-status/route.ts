import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import {
  isMissingSupabaseServerEnv,
  nextMisconfiguredSimple,
} from '@/lib/supabase-env-error'
import { resolveUserIdFromBearer } from '@/lib/auth-resolve-user-id'
import {
  createKsherCscanb,
  isKsherConfigured,
  isKsherOrderPaid,
  parseKsherCreateResponse,
} from '@/lib/ksher-cscanb'
import { completeKsherTopupByMerchantOrderId } from '@/lib/ksher-complete-topup'

function unwrapQueryBody(res: unknown): Record<string, unknown> | null {
  return parseKsherCreateResponse(res).raw
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    let body: { refresh_token?: string; merchantOrderId?: string } = {}
    try {
      body = await request.json().catch(() => ({}))
    } catch {
      // no body
    }
    const refreshToken = body.refresh_token ?? ''
    const merchantOrderId = (body.merchantOrderId ?? '').trim()
    if (!merchantOrderId) {
      return NextResponse.json({ error: 'merchantOrderId is required' }, { status: 400 })
    }

    const userId = await resolveUserIdFromBearer(accessToken, refreshToken)
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired session', code: 'session_invalid' },
        { status: 401 }
      )
    }

    const supabase = createServerSupabase()
    const { data: order, error: ordErr } = await supabase
      .from('ksher_topup_orders')
      .select('status, amount_baht, user_id')
      .eq('merchant_order_id', merchantOrderId)
      .maybeSingle()

    if (ordErr) {
      return NextResponse.json({ error: ordErr.message }, { status: 500 })
    }
    if (!order || order.user_id !== userId) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status === 'paid') {
      const { data: mem } = await supabase
        .from('vending_member')
        .select('credit')
        .eq('id', userId)
        .maybeSingle()
      const newCredit =
        mem?.credit != null ? Number(mem.credit) : undefined
      return NextResponse.json({
        status: 'paid',
        amountBaht: Number(order.amount_baht),
        newCredit,
      })
    }

    if (order.status !== 'pending') {
      return NextResponse.json({
        status: order.status,
        amountBaht: Number(order.amount_baht),
      })
    }

    if (!isKsherConfigured()) {
      return NextResponse.json({ status: 'pending' })
    }

    const sdk = createKsherCscanb()
    try {
      const ksherRes = await sdk.orderQuery(merchantOrderId, {
        timestamp: String(Date.now()),
      })
      const qBody = unwrapQueryBody(ksherRes)
      if (isKsherOrderPaid(qBody)) {
        const done = await completeKsherTopupByMerchantOrderId(supabase, merchantOrderId)
        if (!done.ok) {
          return NextResponse.json(
            { status: 'pending', error: done.error },
            { status: 500 }
          )
        }
        return NextResponse.json({
          status: 'paid',
          amountBaht: Number(order.amount_baht),
          newCredit: done.newCredit,
          duplicate: done.duplicate,
        })
      }
    } catch (e) {
      console.warn('ksher orderQuery:', e)
    }

    return NextResponse.json({
      status: 'pending',
      amountBaht: Number(order.amount_baht),
    })
  } catch (e) {
    console.error('ksher order-status error:', e)
    if (isMissingSupabaseServerEnv(e)) return nextMisconfiguredSimple()
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
