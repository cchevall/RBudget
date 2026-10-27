import type { AppState, Transaction } from '../store/types'
import { pad } from './utils'

/** Minimal CSV parser handling quotes, ; or , or tab separators */
export function parseCSV(text: string): string[][] {
  text = text.replace(/^﻿/, '')
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? ''
  const sep = [';', '\t', ','].map((c) => [c, firstLine.split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0]
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === sep) {
      row.push(cell.trim())
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell.trim())
      if (row.some((c) => c)) rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  row.push(cell.trim())
  if (row.some((c) => c)) rows.push(row)
  return rows
}

/** 25/10/2026, 2026-10-25, 25-10-26, 25.10.2026 -> 2026-10-25 */
export function parseAnyDate(s: string): string | null {
  s = s.trim()
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3]
    return `${y}-${pad(+m[2])}-${pad(+m[1])}`
  }
  return null
}

/** "-1 234,56 €" -> -123456 cents ; handles both 1.234,56 and 1,234.56 */
export function parseAmount(s: string): number | null {
  let t = s.replace(/[\s €$£]/g, '').replace(/EUR/i, '')
  if (!t) return null
  const neg = /^-|^\(|-$/.test(t)
  t = t.replace(/[()+-]/g, '')
  const lastComma = t.lastIndexOf(',')
  const lastDot = t.lastIndexOf('.')
  if (lastComma > lastDot) t = t.replace(/\./g, '').replace(',', '.')
  else t = t.replace(/,/g, '')
  const n = parseFloat(t)
  if (isNaN(n)) return null
  return Math.round(n * 100) * (neg ? -1 : 1)
}

export interface Mapping {
  date: number
  label: number
  amount: number
  /** Some banks split debit/credit in two columns */
  debit: number
  credit: number
  headerRow: boolean
}

/** Guess columns from headers & content */
export function guessMapping(rows: string[][]): Mapping {
  const head = rows[0].map((h) => h.toLowerCase())
  const find = (...keys: string[]) => head.findIndex((h) => keys.some((k) => h.includes(k)))
  const headerRow = rows.length > 1 && !parseAnyDate(rows[0][0]) && rows[0].some((c) => isNaN(parseFloat(c)))
  let date = find('date op', 'date')
  let label = find('libell', 'label', 'description', 'intitul', 'detail', 'nature')
  let amount = find('montant', 'amount', 'valeur')
  const debit = find('débit', 'debit')
  const credit = find('crédit', 'credit')
  const sample = rows[headerRow ? 1 : 0] ?? []
  if (date < 0) date = sample.findIndex((c) => parseAnyDate(c))
  if (amount < 0 && debit < 0) amount = sample.findIndex((c, i) => i !== date && parseAmount(c) !== null && /\d[.,]\d{2}/.test(c))
  if (label < 0) label = sample.reduce((best, c, i) => (c.length > (sample[best]?.length ?? 0) && i !== date && i !== amount ? i : best), 0)
  return { date, label, amount, debit, credit, headerRow }
}

export function rowsToTransactions(rows: string[][], m: Mapping) {
  const out: { date: string; label: string; amount: number }[] = []
  for (const r of rows.slice(m.headerRow ? 1 : 0)) {
    const date = parseAnyDate(r[m.date] ?? '')
    if (!date) continue
    let amount: number | null = null
    if (m.amount >= 0) amount = parseAmount(r[m.amount] ?? '')
    if ((amount === null || amount === 0) && (m.debit >= 0 || m.credit >= 0)) {
      const d = m.debit >= 0 ? parseAmount(r[m.debit] ?? '') : null
      const c = m.credit >= 0 ? parseAmount(r[m.credit] ?? '') : null
      if (d) amount = -Math.abs(d)
      else if (c) amount = Math.abs(c)
    }
    if (!amount) continue
    out.push({ date, label: (r[m.label] ?? '').replace(/\s+/g, ' ').trim(), amount })
  }
  return out
}

export const isDuplicate = (s: AppState, x: { date: string; amount: number; label: string }) =>
  s.transactions.some((t) => t.date === x.date && t.amount === Math.abs(x.amount) && (t.type === 'income') === x.amount > 0)

export function toCSV(s: AppState, tx: Transaction[]) {
  const cat = (id: string) => s.categories.find((c) => c.id === id)?.name ?? id
  const lines = ['date;type;montant;categorie;libelle;note']
  for (const t of tx)
    lines.push([t.date, t.type === 'income' ? 'revenu' : 'depense', ((t.type === 'income' ? 1 : -1) * t.amount / 100).toFixed(2).replace('.', ','), cat(t.categoryId), t.label, t.note ?? ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))
  return '﻿' + lines.join('\n')
}
