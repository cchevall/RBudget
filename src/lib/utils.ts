import type { Cents, DateStr, PeriodKey } from '../store/types'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

// ---------- Money ----------

const fmtCache = new Map<string, Intl.NumberFormat>()
function nf(currency: string, decimals: boolean) {
  const k = currency + decimals
  if (!fmtCache.has(k))
    fmtCache.set(
      k,
      new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency,
        minimumFractionDigits: decimals ? 2 : 0,
        maximumFractionDigits: decimals ? 2 : 0,
      }),
    )
  return fmtCache.get(k)!
}

export let currentCurrency = 'EUR'
export const setCurrency = (c: string) => (currentCurrency = c)

/** Format cents, dropping decimals for round amounts unless `exact` */
export function money(cents: Cents, opts: { exact?: boolean; sign?: boolean } = {}) {
  const round = cents % 100 === 0 && !opts.exact
  const s = nf(currentCurrency, !round).format(cents / 100)
  return opts.sign && cents > 0 ? '+' + s : s
}

/** "12,5" / "12.50" / "1 200" -> cents */
export function parseMoney(input: string): Cents {
  const clean = input.replace(/\s/g, '').replace(/[€$£]/g, '').replace(',', '.')
  const n = parseFloat(clean)
  return isNaN(n) ? 0 : Math.round(n * 100)
}

export const centsToInput = (c: Cents) => (c ? (c / 100).toString().replace('.', ',') : '')

// ---------- Dates ----------

export const pad = (n: number) => String(n).padStart(2, '0')
export const toDateStr = (d: Date): DateStr => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseDate = (s: DateStr) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const today = () => toDateStr(new Date())
export const addDays = (s: DateStr, n: number) => {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}
export const daysBetween = (a: DateStr, b: DateStr) =>
  Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000)

/** Adds months keeping the day (clamped to month length) */
export function addMonths(s: DateStr, n: number, day?: number): DateStr {
  const d = parseDate(s)
  const want = day ?? d.getDate()
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(want, last))
  return toDateStr(target)
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

export function prettyDate(s: DateStr) {
  const t = today()
  if (s === t) return "Aujourd'hui"
  if (s === addDays(t, -1)) return 'Hier'
  const d = parseDate(s)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ' ' + d.getFullYear()}`
}
export const shortDate = (s: DateStr) => {
  const d = parseDate(s)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

// ---------- Budget periods ----------
// startDay 1: the period is the calendar month.
// startDay <= 15 (e.g. 5): period "2026-10" runs 2026-10-05 -> 2026-11-04.
// startDay > 15 (e.g. 28, payday): the period is named after the month most of it covers,
// so "2026-10" runs 2026-09-28 -> 2026-10-27.

let startDay = 1
export const setStartDay = (d: number) => (startDay = Math.min(28, Math.max(1, d)))
const lateStart = () => startDay > 15

export function periodOf(s: DateStr): PeriodKey {
  const d = parseDate(s)
  let m = d.getMonth()
  if (lateStart()) {
    if (d.getDate() >= startDay) m += 1
  } else if (d.getDate() < startDay) m -= 1
  const k = new Date(d.getFullYear(), m, 1)
  return `${k.getFullYear()}-${pad(k.getMonth() + 1)}`
}
export const currentPeriod = () => periodOf(today())

export function periodRange(p: PeriodKey): [DateStr, DateStr] {
  const [y, m] = p.split('-').map(Number)
  const first = lateStart() ? m - 2 : m - 1
  const start = new Date(y, first, startDay)
  const end = new Date(y, first + 1, startDay - 1)
  return [toDateStr(start), toDateStr(end)]
}

export function shiftPeriod(p: PeriodKey, n: number): PeriodKey {
  const [y, m] = p.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function periodLabel(p: PeriodKey, short = false) {
  const [y, m] = p.split('-').map(Number)
  const name = (short ? MONTHS_SHORT : MONTHS)[m - 1]
  const label = name[0].toUpperCase() + name.slice(1)
  return y === new Date().getFullYear() ? label : `${label} ${y}`
}

/** Progress through a period: days elapsed / days total (0..1) */
export function periodProgress(p: PeriodKey) {
  const [a, b] = periodRange(p)
  const total = daysBetween(a, b) + 1
  const t = today()
  if (t < a) return 0
  if (t > b) return 1
  return (daysBetween(a, t) + 1) / total
}
export const daysLeftInPeriod = (p: PeriodKey) => Math.max(0, daysBetween(today(), periodRange(p)[1]) + 1)

// ---------- Text ----------

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
export function median(a: number[]) {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function download(filename: string, content: string, mime = 'application/json') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const vibrate = (ms: number | number[] = 12) => {
  try {
    navigator.vibrate?.(ms)
  } catch {}
}
