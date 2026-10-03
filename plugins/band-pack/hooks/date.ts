const two = (n: number): string => String(n).padStart(2, '0')

// The local calendar date, YYYY-MM-DD: "today" is the person's day, not UTC's.
export const localDate = (at: number): string => {
  const date = new Date(at)
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`
}
