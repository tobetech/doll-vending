import type { SupabaseClient } from '@supabase/supabase-js'
import { isMissingCreditAfterColumnError } from '@/lib/vending-transaction-insert'

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * ยืนยันออเดอร์ pending → บวก credit และบันทึกประวัติ (ใช้จาก webhook / polling)
 * idempotent: ถ้าไม่มีแถว pending จะไม่บวกซ้ำ
 */
export async function completeKsherTopupByMerchantOrderId(
  supabase: SupabaseClient,
  merchantOrderId: string
): Promise<{
  ok: boolean
  duplicate?: boolean
  newCredit?: number
  error?: string
}> {
  const mid = merchantOrderId.trim()
  if (!mid) {
    return { ok: false, error: 'merchant_order_id required' }
  }

  const { data: claimed, error: claimErr } = await supabase
    .from('ksher_topup_orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .eq('merchant_order_id', mid)
    .eq('status', 'pending')
    .select('user_id, amount_baht')
    .maybeSingle()

  if (claimErr) {
    console.error('ksher claim order error:', claimErr)
    return { ok: false, error: claimErr.message }
  }

  if (!claimed) {
    const { data: existing } = await supabase
      .from('ksher_topup_orders')
      .select('status, user_id')
      .eq('merchant_order_id', mid)
      .maybeSingle()
    if (existing?.status === 'paid' && existing.user_id) {
      const { data: mem } = await supabase
        .from('vending_member')
        .select('credit')
        .eq('id', existing.user_id)
        .maybeSingle()
      const nc = mem?.credit != null ? roundMoney(Number(mem.credit)) : undefined
      return { ok: true, duplicate: true, newCredit: nc }
    }
    return { ok: false, error: 'Order not found or not pending' }
  }

  const userId = claimed.user_id as string
  const amountBaht = roundMoney(Number(claimed.amount_baht))

  const { data: member, error: memErr } = await supabase
    .from('vending_member')
    .select('credit')
    .eq('id', userId)
    .maybeSingle()

  if (memErr) {
    console.error('ksher topup member read:', memErr)
    return { ok: false, error: memErr.message }
  }

  const currentCredit = member?.credit != null ? Number(member.credit) : 0
  const newCredit = roundMoney(currentCredit + amountBaht)

  if (!member) {
    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    const email = authUser?.user?.email ?? ''
    const { error: insErr } = await supabase.from('vending_member').insert({
      id: userId,
      email: email || `user-${userId.slice(0, 8)}@ksher.local`,
      credit: newCredit,
    })
    if (insErr) {
      console.error('ksher topup member insert:', insErr)
      return { ok: false, error: insErr.message }
    }
  } else {
    const { error: upMemErr } = await supabase
      .from('vending_member')
      .update({ credit: newCredit })
      .eq('id', userId)
    if (upMemErr) {
      console.error('ksher topup credit update:', upMemErr)
      return { ok: false, error: upMemErr.message }
    }
  }

  const topupBaseInsert: Record<string, unknown> = {
    user_id: userId,
    machine_id: 'ksher-promptpay',
    product_id: 'topup',
    product_name: 'เติมเงิน (PromptPay / Ksher)',
    amount: amountBaht,
    status: 'success',
  }

  let { error: txErr } = await supabase
    .from('vending_transactions')
    .insert({ ...topupBaseInsert, credit_after: newCredit })

  if (txErr && isMissingCreditAfterColumnError(txErr)) {
    ;({ error: txErr } = await supabase.from('vending_transactions').insert(topupBaseInsert))
  }

  if (txErr) {
    console.error('ksher topup transaction insert:', txErr)
    return { ok: false, error: txErr.message }
  }

  return { ok: true, newCredit }
}
