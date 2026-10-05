const two = (n: number): string => String(n).padStart(2, '0')

// The local calendar date, YYYY-MM-DD: "today" is the person's day, not UTC's.
export const localDate = (at: number): string => {
  const date = new Date(at)
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`
}

const parts = (date: string): [number, number, number] => {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number)
  return [y, m, d]
}

// Noon, so a daylight saving jump never moves the date.
export const addDays = (date: string, n: number): string => {
  const [y, m, d] = parts(date)
  return localDate(new Date(y, m - 1, d + n, 12).getTime())
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export const weekday = (date: string): string => {
  const [y, m, d] = parts(date)
  return WEEKDAYS[new Date(y, m - 1, d, 12).getDay()] ?? ''
}

export const isDate = (text: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(text)
