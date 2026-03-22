/**
 * PostgREST ตอนคอลัมน์ credit_after ยังไม่มีในตาราง / schema cache ยังไม่อัปเดต
 * แก้ถาวร: รัน supabase/vending_transactions_credit_after.sql ใน Supabase SQL Editor
 */
export function isMissingCreditAfterColumnError(
  err: { message?: string } | null | undefined
): boolean {
  const m = (err?.message ?? '').toLowerCase()
  return (
    m.includes('credit_after') &&
    (m.includes('schema') ||
      m.includes('column') ||
      m.includes('could not find'))
  )
}
