import type { DateStr, Frequency, Recurring } from '../store/types'
import { addDays, addMonths, parseDate } from './utils'

export const FREQ_LABEL: Record<Frequency, string> = {
  weekly: 'Chaque semaine',
  biweekly: 'Toutes les 2 semaines',
  monthly: 'Chaque mois',
  quarterly: 'Chaque trimestre',
  yearly: 'Chaque année',
}

/** n-th occurrence date of a recurring, derived from its start date (keeps the day stable across short months) */
function nth(r: Recurring, n: number): DateStr {
  const day = parseDate(r.startDate).getDate()
  switch (r.frequency) {
    case 'weekly':
      return addDays(r.startDate, 7 * n)
    case 'biweekly':
      return addDays(r.startDate, 14 * n)
    case 'monthly':
      return addMonths(r.startDate, n, day)
    case 'quarterly':
      return addMonths(r.startDate, 3 * n, day)
    case 'yearly':
      return addMonths(r.startDate, 12 * n, day)
  }
}

/** All occurrence dates within [from, to] (inclusive) */
export function occurrences(r: Recurring, from: DateStr, to: DateStr): DateStr[] {
  const out: DateStr[] = []
  for (let n = 0; n < 2000; n++) {
    const d = nth(r, n)
    if (d > to || (r.endDate && d > r.endDate)) break
    if (d >= from) out.push(d)
  }
  return out
}

export function nextOccurrence(r: Recurring, after: DateStr): DateStr | undefined {
  for (let n = 0; n < 2000; n++) {
    const d = nth(r, n)
    if (r.endDate && d > r.endDate) return undefined
    if (d > after) return d
  }
}

/** Monthly-equivalent amount, handy for "fixed costs per month" */
export function monthlyEquivalent(r: Recurring) {
  switch (r.frequency) {
    case 'weekly':
      return (r.amount * 52) / 12
    case 'biweekly':
      return (r.amount * 26) / 12
    case 'monthly':
      return r.amount
    case 'quarterly':
      return r.amount / 3
    case 'yearly':
      return r.amount / 12
  }
}
