import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

type WebhookBody = {
  userId: string
  machineId: string
  productId?: string
  productName?: string
  amount?: number
  transactionId?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as WebhookBody
    const {
      userId,
      machineId,
      productId = '',
      productName = '',
      amount = 0,
      transactionId,
    } = body

    if (!userId || !machineId) {
      return NextResponse.json(
        { ok: false, error: 'userId and machineId are required' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()
    const { data: row, error } = await supabase
      .from('vending_transactions')
      .insert({
        user_id: userId,
        machine_id: machineId,
        product_id: productId,
        product_name: productName,
        amount: Number(amount),
        status: 'success',
        id: transactionId || undefined,
      })
      .select('id, created_at')
      .single()

    if (error) {
      console.error('Webhook vending insert error:', error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      transactionId: row?.id,
      createdAt: row?.created_at,
    })
  } catch (e) {
    console.error('Webhook vending error:', e)
    return NextResponse.json(
      { ok: false, error: 'Server error' },
      { status: 500 }
    )
  }
}
