import { format, subDays, addDays, parseISO } from 'date-fns'

/**
 * Get today's date in YYYY-MM-DD format using LOCAL timezone.
 * This is the canonical date string format for the entire app.
 * Use this instead of `new Date().toISOString().slice(0, 10)` which uses UTC.
 */
export function todayDate(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dayFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse a YYYY-MM-DD string as a Date at midnight in LOCAL timezone.
 * This prevents the UTC skew that happens with `new Date(dateStr)`.
 */
export function parseDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

export function getRollingWindow(days: number, endDate?: string): { start: string; end: string } {
  const end = endDate || todayDate()
  const endDateObj = parseDateString(end)
  const startDateObj = new Date(endDateObj)
  startDateObj.setDate(startDateObj.getDate() - (days - 1))
  const start = formatDateLocal(startDateObj)
  return { start, end }
}

export function formatHoursToHM(hours: number): string {
  const h = Math.floor(Math.abs(hours))
  const m = Math.round((Math.abs(hours) - h) * 60)
  return `${hours < 0 ? '-' : ''}${h}h ${m}m`
}

/**
 * Format a Date object into YYYY-MM-DD using LOCAL timezone.
 * Canonical date formatter for the app.
 */
export function formatDateLocal(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Returns the start (Monday) and end (Sunday) of the week containing the given date.
 * Uses local timezone throughout.
 */
export function getWeekWindow(anchorDate: string): { weekStart: string; weekEnd: string; weekDates: string[] } {
  const anchor = parseDateString(anchorDate)
  const dayOfWeek = anchor.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(anchor)
  monday.setDate(anchor.getDate() + diffToMonday)

  const weekDates: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    weekDates.push(formatDateLocal(d))
  }

  return {
    weekStart: weekDates[0],
    weekEnd: weekDates[6],
    weekDates,
  }
}

/**
 * Returns the start and end of the month containing the given date.
 * Uses local timezone throughout.
 */
export function getMonthWindow(anchorDate: string): { monthStart: string; monthEnd: string; monthDates: string[]; monthLabel: string } {
  const anchor = parseDateString(anchorDate)
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const monthDates: string[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    monthDates.push(formatDateLocal(new Date(year, month, d)))
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  return {
    monthStart: monthDates[0],
    monthEnd: monthDates[monthDates.length - 1],
    monthDates,
    monthLabel: `${monthNames[month]} ${year}`,
  }
}

/**
 * Shift a date by +/-N months, returning a YYYY-MM-DD string in local timezone.
 */
export function shiftMonth(dateStr: string, delta: number): string {
  const d = parseDateString(dateStr)
  const targetMonth = d.getMonth() + delta
  const targetYear = d.getFullYear() + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const daysInTarget = new Date(targetYear, normalizedMonth + 1, 0).getDate()
  const day = Math.min(d.getDate(), daysInTarget)
  return formatDateLocal(new Date(targetYear, normalizedMonth, day))
}
