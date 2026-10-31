import type { AppState, Cents, DateStr, ImmoSettings } from '../store/types'
import { history } from './stats'
import { smoothed } from './pro'
import { addMonths, daysBetween, today } from './utils'

/** Amount a monthly payment can borrow at a yearly rate over n years (constant annuity) */
export function loanCapacity(monthly: Cents, ratePct: number, years: number): Cents {
  const r = ratePct / 100 / 12
  const n = years * 12
  if (monthly <= 0 || n <= 0) return 0
  return Math.round(r ? (monthly * (1 - Math.pow(1 + r, -n))) / r : monthly * n)
}

/** Net monthly income a bank would look at, from what the app knows */
export function suggestedIncome(s: AppState): Cents {
  if (s.settings.profile === 'ae') return Math.max(0, smoothed(s).net)
  const past = history(s, 3).filter((h) => h.income > 0)
  return past.length ? Math.round(past.reduce((a, h) => a + h.income, 0) / past.length) : 0
}

export const monthsUntil = (d: DateStr) => Math.max(0, Math.round(daysBetween(today(), d) / 30.44))

export interface ImmoPoint {
  date: DateStr
  months: number
  savings: Cents
  crd: Cents
  equity: Cents
  apport: Cents
  loan: Cents
  /** Max price with 3% (new) / 8% (old) notary fees, fees included in the budget */
  priceNew: Cents
  priceOld: Cents
  /** Buying before selling: bridge loan = 70% of the sale value minus what is still owed */
  bridge: Cents
  priceOldBridge: Cents
}

export function immoAt(s: AppState, i: ImmoSettings, months: number): ImmoPoint {
  const income = (i.income || suggestedIncome(s)) + i.coIncome
  const monthly = Math.max(0, Math.round((income * i.maxDebt) / 100) - i.credits)
  const loan = loanCapacity(monthly, i.rate, i.years)
  const savings = i.savings + i.monthlySavings * months + i.coSavings
  const crd = Math.max(0, i.crd - i.crdMonthly * months)
  const equity = i.sell ? Math.max(0, i.saleValue - crd) : 0
  const apport = savings + equity
  const bridge = i.sell ? Math.max(0, Math.round(i.saleValue * 0.7) - crd) : 0
  return {
    date: addMonths(today(), months, 1),
    months,
    savings,
    crd,
    equity,
    apport,
    loan,
    priceNew: Math.round((apport + loan) / 1.03),
    priceOld: Math.round((apport + loan) / 1.08),
    bridge,
    priceOldBridge: Math.round((savings + bridge + loan) / 1.08),
  }
}

export function immoMonthly(s: AppState, i: ImmoSettings) {
  const income = (i.income || suggestedIncome(s)) + i.coIncome
  const max = Math.round((income * i.maxDebt) / 100)
  return { income, max, available: Math.max(0, max - i.credits) }
}
