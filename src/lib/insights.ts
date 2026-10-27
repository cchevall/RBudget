import type { AppState, Transaction } from '../store/types'
import { labelKey } from './autocat'
import { averageByTop, envelopeStatus, forecast, spentByTop, totals } from './stats'
import { addDays, currentPeriod, daysBetween, median, money, periodOf, periodProgress, shiftPeriod, today } from './utils'

export interface Insight {
  id: string
  level: 'alert' | 'warn' | 'info' | 'good'
  emoji: string
  title: string
  text: string
  route?: string
  /** Data used to propose a one-tap fix (e.g. create a recurring) */
  fix?: { kind: 'recurring'; label: string; amount: number; categoryId: string; date: string }
}

const catName = (s: AppState, id: string) => {
  const c = s.categories.find((x) => x.id === id)
  return c ? `${c.emoji} ${c.name}` : id
}

export function detectDuplicates(s: AppState): [Transaction, Transaction][] {
  const since = addDays(today(), -60)
  const recent = s.transactions.filter((t) => t.date >= since && t.type === 'expense' && !t.recurringId && !t.goalId && !t.eventId)
  const out: [Transaction, Transaction][] = []
  const seen = new Set<string>()
  recent.sort((a, b) => a.date.localeCompare(b.date))
  for (let i = 0; i < recent.length; i++)
    for (let j = i + 1; j < recent.length; j++) {
      const a = recent[i]
      const b = recent[j]
      if (daysBetween(a.date, b.date) > 2) break
      if (a.amount === b.amount && labelKey(a.label) === labelKey(b.label) && a.amount >= 500 && !seen.has(b.id)) {
        out.push([a, b])
        seen.add(b.id)
      }
    }
  return out
}

/** Labels that come back every month with a similar amount but aren't set up as recurring */
export function detectSubscriptions(s: AppState) {
  const groups = new Map<string, Transaction[]>()
  for (const t of s.transactions) {
    if (t.type !== 'expense' || t.recurringId || t.goalId || t.eventId) continue
    const k = labelKey(t.label)
    if (!k) continue
    groups.set(k, [...(groups.get(k) ?? []), t])
  }
  const known = new Set(s.recurrings.map((r) => labelKey(r.label)))
  const out: { key: string; label: string; amount: number; categoryId: string; months: number; last: Transaction; increase?: [number, number] }[] = []
  for (const [k, list] of groups) {
    if (known.has(k)) continue
    const months = new Set(list.map((t) => periodOf(t.date)))
    if (months.size < 3 || list.length > months.size * 1.5) continue // several per month = not a subscription
    const amounts = list.map((t) => t.amount)
    const med = median(amounts)
    const similar = amounts.filter((a) => Math.abs(a - med) <= med * 0.15).length
    if (similar < 3) continue
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
    const last = sorted[sorted.length - 1]
    const prev = sorted[sorted.length - 2]
    const increase: [number, number] | undefined = last.amount > prev.amount * 1.03 ? [prev.amount, last.amount] : undefined
    out.push({ key: k, label: last.label, amount: last.amount, categoryId: last.categoryId, months: months.size, last, increase })
  }
  return out
}

export function computeInsights(s: AppState): Insight[] {
  const out: Insight[] = []
  const p = currentPeriod()
  const t = today()

  // Duplicates
  for (const [a, b] of detectDuplicates(s))
    out.push({ id: `dup-${b.id}`, level: 'alert', emoji: '👯', title: 'Doublon possible', text: `« ${a.label || catName(s, a.categoryId)} » de ${money(a.amount)} apparaît 2 fois (${a.date} et ${b.date}). Prélèvement en double ou saisie en double ?`, route: `#/tx?q=${encodeURIComponent(a.label)}` })

  // Unusual amounts
  const since = addDays(t, -30)
  const byCat = new Map<string, number[]>()
  for (const x of s.transactions) if (x.type === 'expense' && x.date < since) byCat.set(x.categoryId, [...(byCat.get(x.categoryId) ?? []), x.amount])
  for (const x of s.transactions) {
    if (x.type !== 'expense' || x.date < since || x.goalId || x.eventId) continue
    const hist = byCat.get(x.categoryId)
    if (!hist || hist.length < 5) continue
    const m = median(hist)
    if (x.amount > Math.max(m * 3, m + 5000))
      out.push({ id: `big-${x.id}`, level: 'warn', emoji: '🧐', title: 'Montant inhabituel', text: `${money(x.amount)} en ${catName(s, x.categoryId)} (« ${x.label || 'sans libellé'} »), d'habitude c'est plutôt ${money(Math.round(m))}.`, route: `#/tx?q=${encodeURIComponent(x.label)}` })
  }

  // Subscriptions & price increases
  for (const sub of detectSubscriptions(s)) {
    if (sub.increase)
      out.push({ id: `inc-${sub.key}`, level: 'warn', emoji: '📈', title: 'Hausse de prix', text: `« ${sub.label} » est passé de ${money(sub.increase[0])} à ${money(sub.increase[1])}. Normal ?` })
    out.push({ id: `sub-${sub.key}`, level: 'info', emoji: '🔁', title: 'Abonnement détecté', text: `« ${sub.label} » revient chaque mois (~${money(sub.amount)}). Je l'ajoute aux récurrentes pour que tu n'aies plus à le saisir ?`, fix: { kind: 'recurring', label: sub.label, amount: sub.amount, categoryId: sub.categoryId, date: sub.last.date } })
  }

  // Envelope pace
  if (periodProgress(p) > 0.15)
    for (const e of s.envelopes) {
      const st = envelopeStatus(s, e, p)
      const total = st.budget + st.carry
      if (total <= 0) continue
      if (st.left < 0)
        out.push({ id: `env-over-${e.id}`, level: 'alert', emoji: '💥', title: 'Enveloppe dépassée', text: `${catName(s, e.categoryId)} : ${money(-st.left)} au-dessus du budget.`, route: '#/envelopes' })
      else if (st.projected > total * 1.1)
        out.push({ id: `env-pace-${e.id}`, level: 'warn', emoji: '🏎️', title: 'Rythme rapide', text: `À ce rythme, ${catName(s, e.categoryId)} finira vers ${money(Math.round(st.projected))} pour ${money(total)} prévus.`, route: '#/envelopes' })
    }

  // Category spikes vs average
  const avg = averageByTop(s, 3)
  if (avg.size)
    for (const [id, v] of spentByTop(s, p)) {
      const a = avg.get(id) ?? 0
      if (a > 2000 && v > a * 1.5 && v - a > 3000)
        out.push({ id: `spike-${id}`, level: 'warn', emoji: '📊', title: 'Dépenses en hausse', text: `${catName(s, id)} : ${money(v)} ce mois-ci contre ${money(Math.round(a))} en moyenne.`, route: '#/stats' })
    }

  // Small expenses adding up
  const small = s.transactions.filter((x) => x.type === 'expense' && periodOf(x.date) === p && x.amount < 1000)
  const bySmallCat = new Map<string, Transaction[]>()
  for (const x of small) bySmallCat.set(x.categoryId, [...(bySmallCat.get(x.categoryId) ?? []), x])
  for (const [id, list] of bySmallCat)
    if (list.length >= 8)
      out.push({ id: `small-${id}`, level: 'info', emoji: '🪙', title: 'Les petites dépenses', text: `${list.length} petits achats en ${catName(s, id)} ce mois-ci = ${money(list.reduce((a, x) => a + x.amount, 0))}. Ça s'additionne vite !` })

  // Reimbursements waiting
  for (const x of s.transactions) {
    if (!x.reimb) continue
    const age = daysBetween(x.date, t)
    const waiting = (x.reimb.secu > 0 && !x.reimb.secuAt) || (x.reimb.mutuelle > 0 && !x.reimb.mutuelleAt)
    if (waiting && age > 21)
      out.push({ id: `reimb-${x.id}`, level: 'warn', emoji: '⏳', title: 'Remboursement en attente', text: `${x.label || catName(s, x.categoryId)} du ${x.date} : toujours pas remboursé après ${age} jours.`, route: '#/health' })
  }

  // Income drop (salary, CAF)
  for (const id of ['salaire', 'caf']) {
    const prev = [1, 2, 3].map((i) => s.transactions.filter((x) => x.categoryId === id && periodOf(x.date) === shiftPeriod(p, -i)).reduce((a, x) => a + x.amount, 0)).filter((v) => v > 0)
    const last = s.transactions.filter((x) => x.categoryId === id && periodOf(x.date) === shiftPeriod(p, -1)).reduce((a, x) => a + x.amount, 0)
    if (prev.length >= 2 && last > 0) {
      const m = median(prev)
      if (last < m * 0.9) out.push({ id: `drop-${id}`, level: 'warn', emoji: '📉', title: 'Revenu en baisse', text: `${catName(s, id)} : ${money(last)} le mois dernier contre ~${money(Math.round(m))} habituellement.` })
    }
  }

  // Forecast
  const f = forecast(s, p)
  if (f.income > 0 && f.endBalance < 0)
    out.push({ id: 'forecast-neg', level: 'alert', emoji: '🌧️', title: 'Fin de mois tendue', text: `Avec les prélèvements à venir, il manquerait ${money(-f.endBalance)} d'ici la fin du mois.`, route: '#/' })

  // Uncategorized
  const divers = s.transactions.filter((x) => x.categoryId === 'divers' && periodOf(x.date) === p)
  if (divers.length >= 5) out.push({ id: 'divers', level: 'info', emoji: '🗃️', title: 'Beaucoup de « Divers »', text: `${divers.length} opérations en Divers ce mois-ci. Les classer rendra les conseils plus précis.`, route: '#/tx?cat=divers' })

  // Backup
  const lb = s.settings.lastBackup
  if (s.transactions.length > 20 && (!lb || Date.now() - lb > 30 * 86400000))
    out.push({ id: 'backup', level: 'info', emoji: '💾', title: 'Pense à sauvegarder', text: lb ? `Dernière sauvegarde il y a ${Math.round((Date.now() - lb) / 86400000)} jours. Tes données ne vivent que sur ce téléphone !` : "Tes données ne vivent que sur ce téléphone : fais une petite sauvegarde !", route: '#/settings' })

  // Good news
  const last = totals(s, shiftPeriod(p, -1))
  if (last.income > 0 && last.savingsRate >= 0.1)
    out.push({ id: 'good-save', level: 'good', emoji: '🌟', title: 'Bravo !', text: `Le mois dernier tu as mis de côté ${Math.round(last.savingsRate * 100)}% de tes revenus.` })

  return out
}
