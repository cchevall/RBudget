import type { AppState, ID } from '../store/types'
import { BUILTIN_RULES } from '../store/defaults'
import { normalize } from './utils'

/** Key used to remember a label: its first two meaningful words ("carrefour market 1234" -> "carrefour market") */
export function labelKey(label: string) {
  const words = normalize(label)
    .split(' ')
    .filter((w) => w.length > 1 && !/^\d+$/.test(w) && !['cb', 'carte', 'prlv', 'sepa', 'vir', 'paiement', 'achat', 'du', 'le', 'la', 'de'].includes(w))
  return words.slice(0, 2).join(' ')
}

export function learnRule(s: AppState, label: string, categoryId: ID) {
  const key = labelKey(label)
  if (!key) return
  const r = s.rules.find((x) => x.key === key)
  if (r) {
    if (r.categoryId === categoryId) r.hits++
    else {
      r.categoryId = categoryId
      r.hits = 1
    }
  } else s.rules.push({ key, categoryId, hits: 1 })
}

/** Best category guesses for a label: learned rules first, then the built-in dictionary */
export function suggestCategories(s: AppState, label: string): ID[] {
  const n = normalize(label)
  if (n.length < 2) return []
  const key = labelKey(label)
  const out: ID[] = []
  const push = (id: ID) => !out.includes(id) && s.categories.some((c) => c.id === id && !c.archived) && out.push(id)

  const exact = s.rules.find((r) => r.key === key)
  if (exact) push(exact.categoryId)
  const first = key.split(' ')[0]
  s.rules
    .filter((r) => r.key.startsWith(first) || (n.length >= 3 && r.key.includes(n)))
    .sort((a, b) => b.hits - a.hits)
    .forEach((r) => push(r.categoryId))
  for (const [k, id] of BUILTIN_RULES) if (` ${n} `.includes(k.length <= 4 ? ` ${k}` : k)) push(id)
  // category names themselves
  for (const c of s.categories) if (normalize(c.name).startsWith(n) || n.includes(normalize(c.name))) push(c.id)
  return out.slice(0, 4)
}

/** Label autocomplete from history, most frequent first */
export function suggestLabels(s: AppState, input: string, type: 'expense' | 'income') {
  const n = normalize(input)
  const counts = new Map<string, { label: string; categoryId: ID; amount: number; n: number }>()
  for (const t of s.transactions) {
    if (t.type !== type || !t.label) continue
    const k = normalize(t.label)
    if (n && !k.includes(n)) continue
    const c = counts.get(k)
    if (c) {
      c.n++
      c.amount = t.amount
      c.categoryId = t.categoryId
    } else counts.set(k, { label: t.label, categoryId: t.categoryId, amount: t.amount, n: 1 })
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 6)
}

/** Most frequent (label, category, amount) combos -> one-tap shortcuts */
export function favorites(s: AppState, limit = 6) {
  const since = Date.now() - 90 * 86400000
  const counts = new Map<string, { label: string; categoryId: ID; amount: number; n: number }>()
  for (const t of s.transactions) {
    if (t.type !== 'expense' || t.recurringId || t.goalId || t.eventId || t.createdAt < since) continue
    const k = `${normalize(t.label)}|${t.categoryId}|${t.amount}`
    const c = counts.get(k)
    if (c) c.n++
    else counts.set(k, { label: t.label, categoryId: t.categoryId, amount: t.amount, n: 1 })
  }
  return [...counts.values()].filter((c) => c.n >= 2).sort((a, b) => b.n - a.n).slice(0, limit)
}
