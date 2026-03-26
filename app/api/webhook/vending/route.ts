import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import {
  isMissingSupabaseServerEnv,
  nextMisconfiguredWebhook,
} from '@/lib/supabase-env-error'
import { isMissingCreditAfterColumnError } from '@/lib/vending-transaction-insert'
const PRICE_PER_UNIT = 10

/** ปัดทศนิยม 2 ตำแหน่ง (เงินบาท) */
function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** แปลง key เป็น lowercase + snake_case เพื่อรองรับ userId / user_id / User-ID ฯลฯ */
function normalizeBodyKeys(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const nk = k
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase()
    out[nk] = v
  }
  return out
}

function readNonEmptyString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  return s.length ? s : undefined
}

/** ดึงตัวเลข non-negative จากหลายชื่อฟิลด์ที่อาจถูกส่งมา */
function parseNonNegativeAmount(
  body: Record<string, unknown>,
  keys: string[]
): number {
  for (const key of keys) {
    const v = body[key]
    if (v == null || v === '') continue
    let n: number
    if (typeof v === 'string') {
      n = parseFloat(v.replace(/,/g, '').trim())
    } else if (typeof v === 'number') {
      n = v
    } else continue
    if (Number.isFinite(n) && n >= 0) return n
  }
  return 0
}

/** ดึงยอดหักจากหลายชื่อฟิลด์ที่ตู้อาจส่ง (ถ้าไม่มีหรือไม่ใช่ตัวเลขจะได้ 0 = ไม่หัก credit) */
function parseDeductAmount(body: Record<string, unknown>): number {
  return parseNonNegativeAmount(body, [
    'amount',
    'deduct',
    'deduction',
    'price',
    'total',
    'cost',
    'baht',
    'value',
    'pay',
    'paid',
    'money',
    'charge',
  ])
}

/** แต้มที่จะบวกเพิ่มจาก webhook (รองรับ refund/refund_point/points/point) */
function parseRefundPoint(body: Record<string, unknown>): number {
  return parseNonNegativeAmount(body, [
    'refund',
    'refund_point',
    'refund_points',
    'point_refund',
    'points',
    'point',
  ])
}

function parseQuantity(body: Record<string, unknown>): number | null {
  const q = parseNonNegativeAmount(body, [
    'quantity',
    'qty',
    'count',
    'item_count',
    'items',
    'piece',
    'pieces',
  ])
  if (!Number.isFinite(q) || q <= 0) return null
  return Math.max(1, Math.round(q))
}

function parseVendingWebhook(raw: unknown): {
  userId: string
  machineId: string
  productId: string
  productName: string
  amount: number
  refundPoint: number
  quantity: number | null
  transactionId?: string
} {
  const b = normalizeBodyKeys(raw)
  const userId =
    readNonEmptyString(b.user_id) ??
    readNonEmptyString(b.userid) ??
    readNonEmptyString(b.member_id) ??
    readNonEmptyString(b.memberid)
  const machineId =
    readNonEmptyString(b.machine_id) ??
    readNonEmptyString(b.machineid) ??
    readNonEmptyString(b.machine)
  const productId = readNonEmptyString(b.product_id) ?? ''
  const productName = readNonEmptyString(b.product_name) ?? ''
  const transactionId = readNonEmptyString(b.transaction_id) ?? readNonEmptyString(b.transactionid)
  const amount = parseDeductAmount(b)
  const refundPoint = parseRefundPoint(b)
  const quantity = parseQuantity(b)
  return {
    userId: userId ?? '',
    machineId: machineId ?? '',
    productId,
    productName,
    amount,
    refundPoint,
    quantity,
    transactionId,
  }
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json()
    const {
      userId,
      machineId,
      productId,
      productName,
      amount,
      refundPoint,
      quantity,
      transactionId,
    } = parseVendingWebhook(raw)

    if (!userId || !machineId) {
      return NextResponse.json(
        { ok: false, error: 'userId and machineId are required' },
        { status: 400 }
      )
    }

    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt < 0) {
      return NextResponse.json(
        { ok: false, error: 'amount must be a non-negative number' },
        { status: 400 }
      )
    }

    if (amt === 0) {
      console.warn(
        '[webhook/vending] amount is 0 — credit will not change. Body keys:',
        raw && typeof raw === 'object' && !Array.isArray(raw)
          ? Object.keys(raw as object).join(', ')
          : '(invalid body)'
      )
    }

    const supabase = createServerSupabase()

    const { data: member, error: memErr } = await supabase
      .from('vending_member')
      .select('credit, point')
      .eq('id', userId)
      .maybeSingle()

    if (memErr) {
      console.error('Webhook vending member read error:', memErr)
      return NextResponse.json(
        { ok: false, error: memErr.message },
        { status: 500 }
      )
    }

    const currentCredit = roundMoney(
      member?.credit != null ? Number(member.credit) : 0
    )
    const currentPoint = member?.point != null ? Number(member.point) : 0
    const amtRounded = roundMoney(amt)
    const refundRounded = Math.max(0, Math.round(refundPoint))
    const quantityUsed =
      quantity != null
        ? quantity
        : amtRounded > 0
          ? Math.max(1, Math.round(amtRounded / PRICE_PER_UNIT))
          : 1
    const refundedTotal = refundRounded * quantityUsed

    if (amtRounded > 0 && currentCredit < amtRounded) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Insufficient credit',
          code: 'insufficient_credit',
          credit: currentCredit,
          required: amtRounded,
        },
        { status: 402 }
      )
    }

    // ยอดใหม่ = credit ปัจจุบัน − amount จาก webhook (เช่น 500 − 10 = 490)
    const newCredit = roundMoney(currentCredit - amtRounded)
    const newPoint = Math.max(0, currentPoint + refundedTotal)

    const { data: updatedMember, error: upErr } = await supabase
      .from('vending_member')
      .update({ credit: newCredit, point: newPoint })
      .eq('id', userId)
      .select('credit, point')
      .maybeSingle()

    if (upErr) {
      console.error('Webhook vending credit update error:', upErr)
      return NextResponse.json(
        { ok: false, error: upErr.message },
        { status: 500 }
      )
    }

    if (!updatedMember || updatedMember.credit == null) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Member not found or credit/point could not be updated',
          code: 'member_update_failed',
        },
        { status: 404 }
      )
    }

    const confirmedCredit = roundMoney(Number(updatedMember.credit))
    const confirmedPoint =
      updatedMember.point != null ? Number(updatedMember.point) : newPoint

    const baseInsert: Record<string, unknown> = {
      user_id: userId,
      machine_id: machineId,
      product_id: productId,
      product_name: productName,
      amount: amtRounded,
      status: 'success',
    }
    if (transactionId) baseInsert.id = transactionId

    let { data: row, error } = await supabase
      .from('vending_transactions')
      .insert({ ...baseInsert, credit_after: confirmedCredit })
      .select('id, created_at')
      .single()

    if (error && isMissingCreditAfterColumnError(error)) {
      console.warn(
        '[webhook/vending] ไม่มีคอลัมน์ credit_after — บันทึกรายการแบบไม่มีฟิลด์นี้ แนะนำรัน supabase/vending_transactions_credit_after.sql'
      )
      ;({ data: row, error } = await supabase
        .from('vending_transactions')
        .insert(baseInsert)
        .select('id, created_at')
        .single())
    }

    if (error) {
      console.error('Webhook vending insert error:', error)
      await supabase
        .from('vending_member')
        .update({ credit: currentCredit, point: currentPoint })
        .eq('id', userId)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      transactionId: row?.id,
      createdAt: row?.created_at,
      newCredit: confirmedCredit,
      newPoint: confirmedPoint,
      deducted: amtRounded,
      refunded: refundedTotal,
      quantity: quantityUsed,
    })
  } catch (e) {
    console.error('Webhook vending error:', e)
    if (isMissingSupabaseServerEnv(e)) return nextMisconfiguredWebhook()
    return NextResponse.json(
      { ok: false, error: 'Server error' },
      { status: 500 }
    )
  }
}
