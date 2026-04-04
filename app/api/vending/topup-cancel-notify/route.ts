import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import {
  isMissingSupabaseServerEnv,
  nextMisconfiguredSimple,
} from '@/lib/supabase-env-error'
import { resolveUserIdFromBearer } from '@/lib/auth-resolve-user-id'

type Body = {
  refresh_token?: string
  token?: string
  userId?: string
  userID?: string
  amount?: unknown
}

/**
 * หลังผู้ใช้กดยกเลิก QR เติมเงิน — แจ้ง n8n (ถ้าตั้ง N8N_TOPUP_CANCEL_WEBHOOK_URL)
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    let body: Body = {}
    try {
      body = (await request.json().catch(() => ({}))) as Body
    } catch {
      // no body
    }
    const refreshToken = body.refresh_token ?? ''
    const sessionUserId = await resolveUserIdFromBearer(accessToken, refreshToken)
    if (!sessionUserId) {
      return NextResponse.json(
        { error: 'Invalid or expired session', code: 'session_invalid' },
        { status: 401 }
      )
    }

    const token = typeof body.token === 'string' ? body.token.trim() : ''
    const bodyUserId =
      (typeof body.userId === 'string' && body.userId.trim()) ||
      (typeof body.userID === 'string' && body.userID.trim()) ||
      ''
    if (!token || !bodyUserId) {
      return NextResponse.json(
        { error: 'token and userId are required' },
        { status: 400 }
      )
    }
    if (bodyUserId !== sessionUserId) {
      return NextResponse.json({ error: 'userId does not match session' }, { status: 403 })
    }

    const amountNum = Number(body.amount)
    const amountBaht = Number.isFinite(amountNum) ? amountNum : undefined

    const supabase = createServerSupabase()
    const { data: tokRow } = await supabase
      .from('vending_topup_token')
      .select('status, expires_at, amount')
      .eq('token', token)
      .eq('user_id', sessionUserId)
      .maybeSingle()

    const n8nUrl = (process.env.N8N_TOPUP_CANCEL_WEBHOOK_URL || '').trim()
    let n8nOk = false
    let n8nError: string | undefined

    if (n8nUrl) {
      const payload = {
        event: 'topup_qr_cancelled' as const,
        userId: sessionUserId,
        token,
        amountBaht,
        cancelledAt: new Date().toISOString(),
        tokenStatus: tokRow?.status ?? null,
        tokenExpiresAt: tokRow?.expires_at ?? null,
        tokenAmount: tokRow?.amount != null ? Number(tokRow.amount) : null,
      }
      try {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 12_000)
        const res = await fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        })
        clearTimeout(t)
        n8nOk = res.ok
        if (!res.ok) {
          n8nError = `n8n HTTP ${res.status}`
        }
      } catch (e) {
        n8nError = e instanceof Error ? e.message : 'fetch failed'
        console.error('[topup-cancel-notify] n8n:', e)
      }
    }

    return NextResponse.json({
      ok: true,
      n8nConfigured: Boolean(n8nUrl),
      ...(n8nUrl ? { n8nDelivered: n8nOk, ...(n8nError ? { n8nError } : {}) } : { skipped: true }),
    })
  } catch (e) {
    console.error('topup-cancel-notify error:', e)
    if (isMissingSupabaseServerEnv(e)) return nextMisconfiguredSimple()
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
