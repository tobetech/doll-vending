/* eslint-disable @typescript-eslint/no-require-imports */
const CscanbSDK = require('ksher-pay/src/cscanb') as new (p: {
  host: string
  token: string
}) => {
  orderCreate: (data: Record<string, unknown>) => Promise<unknown>
  orderQuery: (orderId: string, params: Record<string, unknown>) => Promise<unknown>
  checkSignature: (webhookUrl: string, data: Record<string, unknown>) => boolean
}

export type KsherCscanbInstance = InstanceType<typeof CscanbSDK>

export function getKsherHost(): string {
  const h = (process.env.KSHER_HOST || '').trim().replace(/\/$/, '')
  return h
}

export function getKsherToken(): string {
  return (process.env.KSHER_TOKEN || '').trim()
}

export function isKsherConfigured(): boolean {
  return Boolean(getKsherHost() && getKsherToken())
}

export function createKsherCscanb(): KsherCscanbInstance {
  const host = getKsherHost()
  const token = getKsherToken()
  return new CscanbSDK({ host, token })
}

/** แปลงบาท → หน่วยที่ Ksher ใช้ (บาท × 100 ตามเอกสาร Redirect/C-scan-B) */
export function bahtToKsherAmount(amountBaht: number): number {
  return Math.round((amountBaht + Number.EPSILON) * 100)
}

export function ksherAmountToBaht(amountKsher: number): number {
  return Math.round((amountKsher / 100 + Number.EPSILON) * 100) / 100
}

function unwrapAxiosData(res: unknown): Record<string, unknown> | null {
  if (!res || typeof res !== 'object') return null
  const r = res as { data?: unknown }
  const outer = r.data
  if (!outer || typeof outer !== 'object') return null
  const o = outer as Record<string, unknown>
  const inner = o.data
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    return inner as Record<string, unknown>
  }
  return o
}

export function parseKsherCreateResponse(res: unknown): {
  reserved1?: string
  instance?: string
  raw: Record<string, unknown> | null
} {
  const raw = unwrapAxiosData(res)
  if (!raw) return { raw: null }
  const reserved1 =
    typeof raw.reserved1 === 'string'
      ? raw.reserved1
      : typeof (raw as { data?: { reserved1?: string } }).data?.reserved1 === 'string'
        ? (raw as { data: { reserved1: string } }).data.reserved1
        : undefined
  const instance =
    typeof raw.instance === 'string'
      ? raw.instance
      : typeof raw.order_id === 'string'
        ? raw.order_id
        : undefined
  return { reserved1, instance, raw }
}

/** อ่านสถานะจ่ายสำเร็จจากผล orderQuery (รองรับหลายรูปแบบ) */
export function isKsherOrderPaid(queryBody: Record<string, unknown> | null): boolean {
  if (!queryBody) return false
  const s = JSON.stringify(queryBody).toLowerCase()
  if (/\bpaid\b/.test(s) && /\bstatus/.test(s)) return true
  const status =
    (typeof queryBody.status === 'string' && queryBody.status) ||
    (typeof queryBody.trade_status === 'string' && queryBody.trade_status) ||
    (typeof queryBody.pay_status === 'string' && queryBody.pay_status) ||
    ''
  const u = status.toUpperCase()
  return u === 'PAID' || u === 'SUCCESS' || u === 'COMPLETED' || u === 'COMPLETE'
}

/** URL ที่ลงทะเบียนใน Ksher ต้องตรงทุกตัวอักษรกับที่ใช้ verify webhook */
export function getKsherWebhookVerifyUrl(): string {
  const full = process.env.KSHER_WEBHOOK_URL?.trim()
  if (full) return full.replace(/\/$/, '')
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '')
  if (!base) return ''
  return `${base}/api/webhook/ksher`
}
