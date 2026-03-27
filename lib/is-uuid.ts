/** True if `value` is a non-empty string in standard UUID shape (Postgres accepts this form). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuidString(value: string | undefined | null): boolean {
  if (value == null || typeof value !== 'string') return false
  return UUID_RE.test(value.trim())
}
