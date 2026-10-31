import type { AppState, Cents, DateStr, Invoice, ProKind, ProSettings } from '../store/types'
import { occurrences } from './recurring'
import { addDays, addMonths, daysBetween, money, pad, periodLabel, sum, today } from './utils'

// Everything pro lives in `state.pro`, apart from the transfers to the personal account:
// they are personal incomes in the `remuneration` category, read here as pro withdrawals.

export const REMU = 'remuneration'

export const PRO_KINDS: Record<ProKind, { emoji: string; label: string; color: string; charge: boolean }> = {
  urssaf: { emoji: '🏛️', label: 'URSSAF', color: '#a8d8ff', charge: false },
  cfe: { emoji: '🏢', label: 'CFE', color: '#c9b6ff', charge: true },
  banque: { emoji: '🏦', label: 'Banque & frais', color: '#9fe6e0', charge: true },
  assurance: { emoji: '🛡️', label: 'Assurances & prévoyance', color: '#b0d0ff', charge: true },
  logiciels: { emoji: '💻', label: 'Logiciels & abonnements', color: '#ffb0e0', charge: true },
  materiel: { emoji: '🖥️', label: 'Matériel', color: '#ffd59e', charge: true },
  deplacement: { emoji: '🚆', label: 'Déplacements', color: '#d0d8e8', charge: true },
  formation: { emoji: '📚', label: 'Formation', color: '#9be3c4', charge: true },
  comptable: { emoji: '🧮', label: 'Comptable', color: '#ffe08a', charge: true },
  impots: { emoji: '🧾', label: 'Impôts payés en pro', color: '#ffad9e', charge: false },
  autre: { emoji: '✨', label: 'Autre frais pro', color: '#e0e0f0', charge: true },
}

export const isReel = (p: ProSettings, d: DateStr) => !!p.reelFrom && d >= p.reelFrom
/** URSSAF + formation + optional income tax, in % of turnover */
export const microRate = (p: ProSettings) => p.urssafRate + p.cfpRate + (p.vl ? p.vlRate : 0)

/** EUR amount counted as turnover */
export const declaredOf = (i: Invoice) => i.declared ?? i.received ?? 0
/** EUR value of an invoice, real once paid, estimated before */
export const invoiceEur = (i: Invoice, p: ProSettings) => i.received ?? (i.currency === 'EUR' ? i.amount : Math.round(i.amount * p.fxRate))

export const fmtCur = (cents: Cents, currency: string) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: cents % 100 ? 2 : 0, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100)

// ---------- Sums ----------

const within = (d: DateStr | undefined, from: DateStr, to: DateStr) => !!d && d >= from && d <= to

export const caBetween = (s: AppState, from: DateStr, to: DateStr) => sum(s.pro.invoices.filter((i) => within(i.paidAt, from, to)).map(declaredOf))
export const chargesBetween = (s: AppState, from: DateStr, to: DateStr) => sum(s.pro.expenses.filter((e) => PRO_KINDS[e.kind].charge && within(e.date, from, to)).map((e) => e.amount))
export const urssafPaidBetween = (s: AppState, from: DateStr, to: DateStr) => sum(s.pro.expenses.filter((e) => e.kind === 'urssaf' && within(e.date, from, to)).map((e) => e.amount))
export const remunerations = (s: AppState, from: DateStr, to: DateStr) => s.transactions.filter((t) => t.type === 'income' && t.categoryId === REMU && within(t.date, from, to))

/** Pro account balance, rebuilt from the opening balance */
export function treasury(s: AppState, at = today()) {
  const p = s.pro.settings
  const cashedIn = sum(s.pro.invoices.filter((i) => within(i.paidAt, p.openingDate, at)).map((i) => i.received ?? 0))
  const spent = sum(s.pro.expenses.filter((e) => within(e.date, p.openingDate, at)).map((e) => e.amount))
  const paidOut = sum(remunerations(s, p.openingDate, at).map((t) => t.amount))
  return p.openingBalance + cashedIn - spent - paidOut
}

// ---------- URSSAF declarations (micro) ----------
// Monthly key "2026-10", quarterly key "2026-T4". Due on the last day of the following month.

export function declKeyOf(d: DateStr, freq: ProSettings['declaration']) {
  const [y, m] = d.split('-')
  return freq === 'monthly' ? `${y}-${m}` : `${y}-T${Math.ceil(Number(m) / 3)}`
}

export function declRange(key: string): [DateStr, DateStr] {
  const [y, x] = key.split('-')
  const quarterly = x.startsWith('T')
  const first = quarterly ? (Number(x.slice(1)) - 1) * 3 + 1 : Number(x)
  const start = `${y}-${pad(first)}-01`
  return [start, addDays(addMonths(start, quarterly ? 3 : 1, 1), -1)]
}

export const declDue = (key: string) => addDays(addMonths(addDays(declRange(key)[1], 1), 1, 1), -1)
export const declLabel = (key: string) => (key.includes('T') ? `${key.split('-')[1]} ${key.slice(0, 4)}` : periodLabel(key))

export interface Declaration {
  key: string
  from: DateStr
  to: DateStr
  due: DateStr
  ca: Cents
  estimate: Cents
  paid: Cents
  status: 'open' | 'due' | 'late' | 'paid'
}

/** Every micro declaration period since the tracking started, oldest first */
export function declarations(s: AppState): Declaration[] {
  const p = s.pro.settings
  const t = today()
  const out: Declaration[] = []
  let key = declKeyOf(p.openingDate, p.declaration)
  for (let i = 0; i < 400; i++) {
    const [from, to] = declRange(key)
    if (from > t || isReel(p, from)) break
    const payments = s.pro.expenses.filter((e) => e.kind === 'urssaf' && e.urssafPeriod === key)
    const ca = caBetween(s, from, to)
    const due = declDue(key)
    out.push({
      key,
      from,
      to,
      due,
      ca,
      estimate: Math.round((ca * microRate(p)) / 100),
      paid: sum(payments.map((e) => e.amount)),
      status: payments.length ? 'paid' : to >= t ? 'open' : t > due ? 'late' : 'due',
    })
    key = declKeyOf(addDays(to, 1), p.declaration)
  }
  return out
}

// ---------- What can I pay myself? ----------

export function proSummary(s: AppState) {
  const p = s.pro.settings
  const t = today()
  const decls = declarations(s)
  const urssafMicro = sum(decls.filter((d) => d.status !== 'paid').map((d) => d.estimate))
  // At réel, contributions are only estimated: keep a share of the profit made since the switch
  let urssafReel = 0
  if (p.reelFrom && t >= p.reelFrom) {
    const from = p.reelFrom > p.openingDate ? p.reelFrom : p.openingDate
    const profit = caBetween(s, from, t) - chargesBetween(s, from, t)
    urssafReel = Math.max(0, Math.round((profit * p.reelRate) / 100) - urssafPaidBetween(s, from, t))
  }
  const year = t.slice(0, 4)
  const cfe = p.cfe > 0 && !s.pro.expenses.some((e) => e.kind === 'cfe' && e.date.startsWith(year)) ? p.cfe : 0
  const in30 = addDays(t, 30)
  let upcoming = 0
  for (const r of s.pro.recurrings) if (!r.paused) upcoming += r.amount * occurrences(r, addDays(t, 1), in30).length
  const cash = treasury(s)
  const reserved = urssafMicro + urssafReel + cfe + upcoming + p.cushion
  const unpaid = s.pro.invoices.filter((i) => !i.paidAt).sort((a, b) => a.date.localeCompare(b.date))
  return {
    cash,
    urssaf: urssafMicro + urssafReel,
    cfe,
    upcoming,
    reserved,
    available: cash - reserved,
    next: decls.find((d) => d.status !== 'paid' && d.status !== 'open') ?? decls.find((d) => d.status === 'open'),
    late: decls.filter((d) => d.status === 'late'),
    unpaid,
    pendingIn: sum(unpaid.map((i) => invoiceEur(i, p))),
  }
}

/** Monthly averages over the last 12 months (or since the first payment) */
export function smoothed(s: AppState) {
  const p = s.pro.settings
  const t = today()
  const from = addDays(addMonths(t, -12), 1)
  const firstPaid = s.pro.invoices.map((i) => i.paidAt).filter((d): d is string => !!d && d >= from).sort()[0]
  const months = firstPaid ? Math.max(1, Math.min(12, daysBetween(firstPaid, t) / 30.44)) : 1
  const ca = caBetween(s, from, t)
  const charges = chargesBetween(s, from, t)
  const cotis = isReel(p, t) ? ((ca - charges) * p.reelRate) / 100 : (ca * microRate(p)) / 100
  const per = (x: number) => Math.round(x / months)
  return { ca: per(ca), charges: per(charges), cotis: per(cotis), net: per(ca - charges - cotis), months }
}

// ---------- Thresholds & taxes ----------

export function yearCA(s: AppState, year: number | string) {
  return caBetween(s, `${year}-01-01`, `${year}-12-31`)
}

/** Income tax form boxes (2042-C-PRO) for micro-entrepreneurs */
export function taxBox(p: ProSettings) {
  if (p.activity === 'bnc') return p.vl ? '5TE' : '5HQ'
  if (p.activity === 'bic-services') return p.vl ? '5TB' : '5KP'
  return p.vl ? '5TA' : '5KO'
}

/** Taxable income for a civil year: turnover minus the flat allowance (micro) or the actual profit (réel) */
export function taxable(s: AppState, year: number | string) {
  const p = s.pro.settings
  const from = `${year}-01-01`
  const to = `${year}-12-31`
  const ca = caBetween(s, from, to)
  if (isReel(p, from)) return Math.max(0, ca - chargesBetween(s, from, to) - urssafPaidBetween(s, from, to))
  // The flat allowance is at least 305 €
  return Math.max(0, ca - Math.max(30500, Math.round((ca * p.abattement) / 100)))
}

// ---------- Calendar ----------

export interface Deadline {
  date: DateStr
  emoji: string
  title: string
  text?: string
  amount?: Cents
  level?: 'warn' | 'bad' | 'info'
}

export function deadlines(s: AppState): Deadline[] {
  const p = s.pro.settings
  const t = today()
  const y = Number(t.slice(0, 4))
  const out: Deadline[] = []
  for (const d of declarations(s))
    if (d.status !== 'paid')
      out.push({
        date: d.due,
        emoji: '🏛️',
        title: `URSSAF · ${declLabel(d.key)}`,
        text: d.status === 'open' ? `en cours · CA ${money(d.ca)} pour l'instant` : `CA à déclarer : ${money(d.ca, { exact: true })}`,
        amount: d.estimate,
        level: d.status === 'late' ? 'bad' : d.status === 'due' ? 'warn' : undefined,
      })
  if (p.cfe > 0 && !s.pro.expenses.some((e) => e.kind === 'cfe' && e.date.startsWith(String(y))))
    out.push({ date: `${y}-12-15`, emoji: '🏢', title: 'CFE', text: 'Avis sur impots.gouv (espace pro) en novembre', amount: p.cfe })
  const declYear = t <= `${y}-06-05` ? y : y + 1
  const boxIncome = declYear - 1
  out.push({
    date: `${declYear}-05-20`,
    emoji: '📝',
    title: `Déclaration de revenus ${boxIncome}`,
    text: isReel(p, `${boxIncome}-01-01`) ? 'Liasse 2035 (avec ton comptable) puis 2042-C-PRO' : `2042-C-PRO, case ${taxBox(p)} : ${money(yearCA(s, boxIncome))} de CA`,
    level: 'info',
  })
  if (p.reelFrom && p.reelFrom > t)
    out.push({ date: p.reelFrom, emoji: '🔀', title: 'Passage au régime réel', text: 'Comptable, compte pro dédié, comptabilité d’engagement : à préparer avant', level: 'info' })
  for (const r of s.pro.recurrings)
    if (!r.paused) for (const d of occurrences(r, addDays(t, 1), addDays(t, 30))) out.push({ date: d, emoji: PRO_KINDS[r.categoryId as ProKind]?.emoji ?? '🔁', title: r.label, amount: r.amount })
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

// ---------- Invoices ----------

/** F2600024 -> F2600025, and F2600024 -> F2700001 once the year changed */
export function nextInvoiceNumber(s: AppState, date = today()) {
  const last = [...s.pro.invoices].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt).pop()
  const yy = date.slice(2, 4)
  if (!last) return `F${yy}00001`
  const m = last.number.match(/^(.*?)(\d+)$/)
  if (!m) return last.number + '-2'
  const [, prefix, digits] = m
  const lastYy = last.date.slice(2, 4)
  if (digits.length >= 5 && digits.startsWith(lastYy) && lastYy !== yy) return prefix + yy + '1'.padStart(digits.length - 2, '0')
  return prefix + String(Number(digits) + 1).padStart(digits.length, '0')
}

// ---------- Export ----------

export function proCSV(s: AppState, year: string) {
  const p = s.pro.settings
  const cell = (v: string | number) => (typeof v === 'number' ? (v / 100).toFixed(2).replace('.', ',') : `"${v.replace(/"/g, '""')}"`)
  const rows: (string | number)[][] = [['Type', 'Date', 'Numéro / libellé', 'Client / nature', 'Montant devise', 'Devise', 'Encaissé EUR', 'Déclaré EUR', 'Date encaissement']]
  for (const i of s.pro.invoices.filter((x) => (x.paidAt ?? x.date).startsWith(year)).sort((a, b) => a.date.localeCompare(b.date)))
    rows.push(['Facture', i.date, i.number, i.client, i.amount, i.currency, i.received ?? '', i.paidAt ? declaredOf(i) : '', i.paidAt ?? ''])
  for (const e of s.pro.expenses.filter((x) => x.date.startsWith(year)).sort((a, b) => a.date.localeCompare(b.date)))
    rows.push(['Dépense', e.date, e.label, PRO_KINDS[e.kind].label, e.amount, 'EUR', '', '', ''])
  for (const t of remunerations(s, `${year}-01-01`, `${year}-12-31`)) rows.push(['Virement perso', t.date, t.label || 'Rémunération', '', t.amount, 'EUR', '', '', ''])
  rows.push([])
  rows.push(['Total CA déclaré', '', '', '', yearCA(s, year), 'EUR', '', '', ''])
  rows.push([`Revenu imposable estimé (case ${taxBox(p)})`, '', '', '', taxable(s, year), 'EUR', '', '', ''])
  return rows.map((r) => r.map((v) => (v === '' ? '' : cell(v))).join(';')).join('\n')
}
