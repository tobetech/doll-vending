/** แบบเก่า (ใส่ userId ใน QR) */
export interface VendingQRPayload {
  userId: string
  email?: string
  ts?: number
}

/** Dynamic QR — ใน QR มีแค่ token ที่เปลี่ยนทุกครั้ง */
export interface VendingQRDynamicPayload {
  token: string
  expiresAt?: string
}

export interface VendingTransaction {
  id: string
  user_id: string
  machine_id: string
  product_id: string
  product_name: string
  amount: number
  status: 'success' | 'failed' | 'pending'
  created_at: string
  webhook_received_at?: string
}
