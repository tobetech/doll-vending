import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

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

/** ดึงยอดหักจากหลายชื่อฟิลด์ที่ตู้อาจส่ง (ถ้าไม่มีหรือไม่ใช่ตัวเลขจะได้ 0 = ไม่หัก credit) */
function parseDeductAmount(body: Record<string, unknown>): number {
  const keys = [
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
  ]
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

function parseVendingWebhook(raw: unknown): {
  userId: string
  machineId: string
  productId: string
  productName: string
  amount: number
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
  return {
    userId: userId ?? '',
    machineId: machineId ?? '',
    productId,
    productName,
    amount,
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
      .select('credit')
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
    const amtRounded = roundMoney(amt)

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

    const { data: updatedMember, error: upErr } = await supabase
      .from('vending_member')
      .update({ credit: newCredit })
      .eq('id', userId)
      .select('credit')
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
          error: 'Member not found or credit could not be updated',
          code: 'member_update_failed',
        },
        { status: 404 }
      )
    }

    const confirmedCredit = roundMoney(Number(updatedMember.credit))

    const { data: row, error } = await supabase
      .from('vending_transactions')
      .insert({
        user_id: userId,
        machine_id: machineId,
        product_id: productId,
        product_name: productName,
        amount: amtRounded,
        status: 'success',
        credit_after: confirmedCredit,
        id: transactionId || undefined,
      })
      .select('id, created_at')
      .single()

    if (error) {
      console.error('Webhook vending insert error:', error)
      await supabase
        .from('vending_member')
        .update({ credit: currentCredit })
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
      deducted: amtRounded,
    })
  } catch (e) {
    console.error('Webhook vending error:', e)
    return NextResponse.json(
      { ok: false, error: 'Server error' },
      { status: 500 }
    )
  }
}
