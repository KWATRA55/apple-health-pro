import { format, subDays, parseISO } from 'date-fns'

export function todayDate(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function daysAgo(days: number): string {
  return format(subDays(new Date(), days), 'yyyy-MM-dd')
}

export function getRollingWindow(days: number, endDate?: string): { start: string; end: string } {
  const end = endDate || todayDate()
  const start = format(subDays(parseISO(end), days - 1), 'yyyy-MM-dd')
  return { start, end }
}

export function isoToDate(isoString: string): string {
  return format(parseISO(isoString), 'yyyy-MM-dd')
}

export function formatMetric(value: number, decimals: number = 1): string {
  return value.toFixed(decimals)
}

export function formatHoursToHM(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}h ${m}m`
}

export function dateRangeArray(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  let current = start
  while (current <= end) {
    dates.push(format(current, 'yyyy-MM-dd'))
    current = subDays(current, -1)
  }
  return dates
}
