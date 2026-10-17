export function formatTimestamp(
  value: string | Date | null | undefined,
): Date {
  if (!value) return new Date()
  if (typeof value === 'string') return new Date(value)
  if (value instanceof Date) return value
  return new Date()
}
