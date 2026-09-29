import { Timestamp } from 'firebase/firestore'

export function formatTimestamp(
  value: Timestamp | string | Date | null | undefined,
): Date {
  if (!value) return new Date()
  if (typeof value === 'string') return new Date(value)
  if (value instanceof Date) return value
  if ('toDate' in value && typeof value.toDate === 'function') return value.toDate()
  return new Date()
}
