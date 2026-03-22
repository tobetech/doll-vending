import { NextResponse } from 'next/server'

/** ตรงกับข้อความใน createServerSupabase() เมื่อ env ไม่ครบ */
export function isMissingSupabaseServerEnv(e: unknown): boolean {
  return (
    e instanceof Error &&
    e.message.includes('Missing NEXT_PUBLIC_SUPABASE_URL')
  )
}

const MISCONFIGURED_MSG =
  'Server misconfigured: add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel → Environment Variables (all environments), then Redeploy.'

/** Webhook / API ที่ใช้ { ok: false } */
export function nextMisconfiguredWebhook(): NextResponse {
  return NextResponse.json(
    { ok: false, error: MISCONFIGURED_MSG, code: 'server_misconfigured' },
    { status: 503 }
  )
}

/** validate / topup-validate ที่ใช้ { success: false } */
export function nextMisconfiguredValidate(): NextResponse {
  return NextResponse.json(
    { success: false, error: MISCONFIGURED_MSG, code: 'server_misconfigured' },
    { status: 503 }
  )
}

/** qr-token ฯลฯ */
export function nextMisconfiguredSimple(): NextResponse {
  return NextResponse.json(
    { error: MISCONFIGURED_MSG, code: 'server_misconfigured' },
    { status: 503 }
  )
}
