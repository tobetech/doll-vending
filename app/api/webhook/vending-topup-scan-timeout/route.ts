import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import {
  isMissingSupabaseServerEnv,
  nextMisconfiguredWebhook,
} from '@/lib/supabase-env-error'
import { isUuidString } from '@/lib/is-uuid'

type Body = {
  token?: string
  machineId?: string
  machine_id?: string
}

function isMachineAuthorized(request: NextRequest): boolean {
  const secret = process.env.VENDING_TOPUP_MACHINE_SECRET?.trim()
  if (!secret) return true
  const auth = request.headers.get('authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (bearer === secret) return true
  const h = request.headers.get('x-vending-topup-secret')
  return h === secret
}

/**
 * ตู้เติมเงิน (ESP32): หมดเวลารอสแกน QR — อัปเดต token เป็น scan_timeout
 * แอปหน้าเติมเงินฟัง Realtime/poll แล้วแสดงข้อความและกลับเมนู
 */
export async function POST(request: NextRequest) {
  try {
    if (!isMachineAuthorized(request)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const raw = await request.json().catch(() => ({}))
    const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Body) : {}
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    const machineId =
      (typeof body.machine_id === 'string' && body.machine_id.trim()) ||
      (typeof body.machineId === 'string' && body.machineId.trim()) ||
      null

    if (!token || !isUuidString(token)) {
      return NextResponse.json(
        { ok: false, error: 'token must be a valid UUID' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabase()

    const { data: row, error: readErr } = await supabase
      .from('vending_topup_token')
      .select('status, user_id')
      .eq('token', token)
      .maybeSingle()

    if (readErr) {
      console.error('vending-topup-scan-timeout read:', readErr)
      return NextResponse.json(
        { ok: false, error: readErr.message },
        { status: 500 }
      )
    }

    if (!row) {
      return NextResponse.json(
        { ok: false, error: 'Token not found', code: 'not_found' },
        { status: 404 }
      )
    }

    const status = String(row.status ?? '')

    if (status === 'scan_timeout') {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        message: 'Already marked as scan timeout',
      })
    }

    if (status === 'completed') {
      return NextResponse.json({
        ok: true,
        skipped: true,
        message: 'Token already completed',
      })
    }

    if (status === 'locked') {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Token is locked (scan already validated); cannot apply scan timeout',
          code: 'already_locked',
        },
        { status: 409 }
      )
    }

    if (status !== 'pending') {
      return NextResponse.json(
        { ok: false, error: `Unexpected token status: ${status}` },
        { status: 409 }
      )
    }

    const patch: Record<string, unknown> = { status: 'scan_timeout' }
    if (machineId) patch.machine_id = machineId

    const { data: updated, error: updErr } = await supabase
      .from('vending_topup_token')
      .update(patch)
      .eq('token', token)
      .eq('status', 'pending')
      .select('token')
      .maybeSingle()

    if (updErr) {
      if (
        updErr.message?.includes('violates check constraint') ||
        updErr.code === '23514'
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Database constraint: run supabase/vending_topup_token_scan_timeout_migration.sql to allow status scan_timeout',
            code: 'schema_outdated',
          },
          { status: 503 }
        )
      }
      console.error('vending-topup-scan-timeout update:', updErr)
      return NextResponse.json(
        { ok: false, error: updErr.message },
        { status: 500 }
      )
    }

    if (!updated) {
      return NextResponse.json({
        ok: true,
        updated: false,
        message: 'Token was not pending (race)',
      })
    }

    return NextResponse.json({ ok: true, updated: true })
  } catch (e) {
    console.error('vending-topup-scan-timeout:', e)
    if (isMissingSupabaseServerEnv(e)) return nextMisconfiguredWebhook()
    return NextResponse.json(
      { ok: false, error: 'Server error' },
      { status: 500 }
    )
  }
}
