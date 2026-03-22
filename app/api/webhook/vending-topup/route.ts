import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import {
  isMissingSupabaseServerEnv,
  nextMisconfiguredWebhook,
} from '@/lib/supabase-env-error'

type WebhookBody = {
  token: string
  userId: string
  amount: number
  machineId: string
  transactionId?: string
}

/**
 * ตู้เติมเงิน: หลังลูกค้าใส่จำนวนเงินและรับเงินสำเร็จ
 * ต้องส่ง token เดียวกับที่ validate แล้ว (สถานะ locked)
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as WebhookBody
    const { token, userId, machineId, transactionId } = body
    const amount = Number(body.amount)

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'token is required' },
        { status: 400 }
      )
    }
    if (!userId || !machineId) {
      return NextResponse.json(
        { ok: false, error: 'userId and machineId are required' },
        { status: 400 }
      )
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { ok: false, error: 'amount must be a positive number' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()

    const { data: completedRow, error: completeError } = await supabase
      .from('vending_topup_token')
      .update({
        status: 'completed',
        amount,
        machine_id: machineId,
        completed_at: new Date().toISOString(),
      })
      .eq('token', token.trim())
      .eq('user_id', userId)
      .eq('status', 'locked')
      .select('token')
      .maybeSingle()

    if (completeError) {
      console.error('vending-topup webhook complete error:', completeError)
      return NextResponse.json(
        { ok: false, error: completeError.message },
        { status: 500 }
      )
    }

    if (!completedRow) {
      const { data: existing } = await supabase
        .from('vending_topup_token')
        .select('status, amount')
        .eq('token', token.trim())
        .eq('user_id', userId)
        .maybeSingle()

      if (existing?.status === 'completed') {
        return NextResponse.json({
          ok: true,
          duplicate: true,
          message: 'Top-up already recorded for this token',
        })
      }

      return NextResponse.json(
        {
          ok: false,
          error:
            'Token is not locked for this user — call topup-validate first or token mismatch',
        },
        { status: 409 }
      )
    }

    const { data: member, error: memErr } = await supabase
      .from('vending_member')
      .select('credit')
      .eq('id', userId)
      .maybeSingle()

    if (memErr) {
      console.error('vending-topup member read error:', memErr)
      return NextResponse.json(
        { ok: false, error: memErr.message },
        { status: 500 }
      )
    }

    const currentCredit = member?.credit != null ? Number(member.credit) : 0
    const newCredit = currentCredit + amount

    if (!member) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId)
      const email = authUser?.user?.email ?? ''
      const { error: insErr } = await supabase.from('vending_member').insert({
        id: userId,
        email: email || `user-${userId.slice(0, 8)}@topup.local`,
        credit: newCredit,
      })
      if (insErr) {
        console.error('vending-topup member insert error:', insErr)
        return NextResponse.json(
          { ok: false, error: insErr.message },
          { status: 500 }
        )
      }
    } else {
      const { error: upMemErr } = await supabase
        .from('vending_member')
        .update({ credit: newCredit })
        .eq('id', userId)

      if (upMemErr) {
        console.error('vending-topup credit update error:', upMemErr)
        return NextResponse.json(
          { ok: false, error: upMemErr.message },
          { status: 500 }
        )
      }
    }

    const { data: txRow, error: txErr } = await supabase
      .from('vending_transactions')
      .insert({
        user_id: userId,
        machine_id: machineId,
        product_id: 'topup',
        product_name: 'เติมเงิน (ตู้เติมเงิน)',
        amount,
        status: 'success',
        credit_after: newCredit,
        id: transactionId || undefined,
      })
      .select('id, created_at')
      .single()

    if (txErr) {
      console.error('vending-topup transaction insert error:', txErr)
      return NextResponse.json(
        { ok: false, error: txErr.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      transactionId: txRow?.id,
      createdAt: txRow?.created_at,
      newCredit,
    })
  } catch (e) {
    console.error('vending-topup webhook error:', e)
    if (isMissingSupabaseServerEnv(e)) return nextMisconfiguredWebhook()
    return NextResponse.json(
      { ok: false, error: 'Server error' },
      { status: 500 }
    )
  }
}
