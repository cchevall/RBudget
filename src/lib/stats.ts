import type { AppState, Envelope, ID, PeriodKey, Transaction } from '../store/types'
import { occurrences } from './recurring'
import { addDays, currentPeriod, daysLeftInPeriod, periodOf, periodRange, shiftPeriod, today } from './utils'

export const inPeriod = (t: Transaction, p: PeriodKey) => {
  const [a, b] = periodRange(p)
  return t.date >= a && t.date <= b
}

export const txOfPeriod = (s: AppState, p: PeriodKey) => s.transactions.filter((t) => inPeriod(t, p))

/** Category id + its sub-categories */
export function subtree(s: AppState, id: ID): Set<ID> {
  const set = new Set([id])
  for (const c of s.categories) if (c.parentId === id) set.add(c.id)
  return set
}

export const topCategory = (s: AppState, id: ID) => s.categories.find((c) => c.id === id)?.parentId ?? id

export function totals(s: AppState, p: PeriodKey) {
  let income = 0
  let expense = 0
  let reimb = 0
  for (const t of txOfPeriod(s, p)) {
    if (t.type === 'income') {
      if (t.reimbOf) reimb += t.amount
      else income += t.amount
    } else expense += t.amount
  }
  // Reimbursements reduce spending rather than counting as income
  const netExpense = expense - reimb
  return { income, expense: netExpense, net: income - netExpense, savingsRate: income ? (income - netExpense) / income : 0 }
}

/** Net spending per category id in a period (reimbursements are deducted from the original category) */
export function spentByCategory(s: AppState, p: PeriodKey): Map<ID, number> {
  const m = new Map<ID, number>()
  const byId = new Map(s.transactions.map((t) => [t.id, t]))
  for (const t of txOfPeriod(s, p)) {
    if (t.type === 'expense') m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount)
    else if (t.reimbOf) {
      const orig = byId.get(t.reimbOf)
      if (orig) m.set(orig.categoryId, (m.get(orig.categoryId) ?? 0) - t.amount)
    }
  }
  return m
}

/** Spending grouped by top-level categories, sorted desc */
export function spentByTop(s: AppState, p: PeriodKey) {
  const m = new Map<ID, number>()
  for (const [id, v] of spentByCategory(s, p)) {
    const top = topCategory(s, id)
    m.set(top, (m.get(top) ?? 0) + v)
  }
  return [...m.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
}

export function envelopeAmount(e: Envelope, p: PeriodKey) {
  let amount = 0
  for (const h of e.history) if (h.from <= p) amount = h.amount
  return amount
}

export interface EnvelopeStatus {
  envelope: Envelope
  budget: number
  carry: number
  spent: number
  left: number
  ratio: number
  /** Projected spending at end of period if the current pace continues */
  projected: number
}

export function envelopeStatus(s: AppState, e: Envelope, p: PeriodKey, spentMap = spentByCategory(s, p)): EnvelopeStatus {
  const ids = subtree(s, e.categoryId)
  let spent = 0
  for (const [id, v] of spentMap) if (ids.has(id)) spent += v
  let carry = 0
  if (e.rollover) {
    const first = e.history[0]?.from ?? p
    let q = first
    let guard = 0
    while (q < p && guard++ < 36) {
      const sm = spentByCategory(s, q)
      let sp = 0
      for (const [id, v] of sm) if (ids.has(id)) sp += v
      carry = carry + envelopeAmount(e, q) - sp
      q = shiftPeriod(q, 1)
    }
  }
  const budget = envelopeAmount(e, p)
  const total = budget + carry
  const left = total - spent
  const [a, b] = periodRange(p)
  const elapsed = Math.min(1, Math.max(0.05, (Math.min(+new Date(), +new Date(b + 'T23:59')) - +new Date(a)) / (+new Date(b + 'T23:59') - +new Date(a))))
  const projected = p === currentPeriod() ? spent / elapsed : spent
  return { envelope: e, budget, carry, spent, left, ratio: total > 0 ? spent / total : spent > 0 ? 2 : 0, projected }
}

/** Forecast for the current period: money left once upcoming bills are paid */
export function forecast(s: AppState, p: PeriodKey = currentPeriod()) {
  const t = totals(s, p)
  const [, end] = periodRange(p)
  const tomorrow = addDays(today(), 1)
  let upcomingIncome = 0
  let upcomingExpense = 0
  const upcoming: { label: string; date: string; amount: number; type: 'income' | 'expense'; categoryId: ID }[] = []
  for (const r of s.recurrings) {
    if (r.paused) continue
    for (const d of occurrences(r, tomorrow, end)) {
      upcoming.push({ label: r.label, date: d, amount: r.amount, type: r.type, categoryId: r.categoryId })
      if (r.type === 'income') upcomingIncome += r.amount
      else upcomingExpense += r.amount
    }
  }
  for (const pend of s.pending) {
    const r = s.recurrings.find((x) => x.id === pend.recurringId)
    if (!r || periodOf(pend.date) !== p) continue
    upcoming.push({ label: r.label, date: pend.date, amount: r.amount, type: r.type, categoryId: r.categoryId })
    if (r.type === 'income') upcomingIncome += r.amount
    else upcomingExpense += r.amount
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date))
  const endBalance = t.income + upcomingIncome - t.expense - upcomingExpense
  const days = daysLeftInPeriod(p)
  return { ...t, upcomingIncome, upcomingExpense, upcoming, endBalance, perDay: days ? Math.max(0, endBalance) / days : 0, days }
}

/** Last n periods totals, oldest first */
export function history(s: AppState, n: number, until = currentPeriod()) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const p = shiftPeriod(until, -i)
    out.push({ period: p, ...totals(s, p) })
  }
  return out
}

/** Average monthly spending per top category over the n previous complete periods */
export function averageByTop(s: AppState, n = 3) {
  const m = new Map<ID, number>()
  const cur = currentPeriod()
  for (let i = 1; i <= n; i++) for (const [id, v] of spentByTop(s, shiftPeriod(cur, -i))) m.set(id, (m.get(id) ?? 0) + v / n)
  return m
}

/** Number of distinct periods that contain data */
export const periodsWithData = (s: AppState) => new Set(s.transactions.map((t) => periodOf(t.date))).size
