import type { AppState, Transaction } from '../store/types'
import { defaultState } from '../store/defaults'
import { addDays, addMonths, currentPeriod, periodRange, setStartDay, shiftPeriod, today, uid } from './utils'

/** Three months of plausible data to explore the app */
export function demoState(): AppState {
  const s = defaultState()
  s.settings.name = 'Toi'
  s.settings.onboarded = true
  s.settings.monthStartDay = 28
  setStartDay(28)
  let seed = 42
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const between = (a: number, b: number) => Math.round(a + rnd() * (b - a))
  const tx = (date: string, categoryId: string, label: string, amount: number, type: 'expense' | 'income' = 'expense', extra: Partial<Transaction> = {}) =>
    s.transactions.push({ id: uid(), type, amount, date, categoryId, label, createdAt: Date.now() - 86400000, ...extra })

  const start = periodRange(shiftPeriod(currentPeriod(), -3))[0]
  const t = today()
  for (let d = start; d <= t; d = addDays(d, 1)) {
    const day = Number(d.slice(8))
    const dow = new Date(d).getDay()
    if (rnd() < 0.35) tx(d, 'boulangerie', 'Boulangerie', between(120, 450))
    if (dow === 6) tx(d, 'courses', rnd() < 0.6 ? 'Carrefour' : 'Lidl', between(6000, 11000))
    if (rnd() < 0.07) tx(d, 'resto', rnd() < 0.5 ? 'Pizzeria' : 'Sushi', between(2500, 6500))
    if (rnd() < 0.03) tx(d, 'shopping', 'Amazon', between(1200, 3500))
    if (rnd() < 0.03) tx(d, 'sante-pharma', 'Pharmacie', between(800, 2600))
    if (rnd() < 0.04) tx(d, 'sorties', 'Cinéma', between(1800, 3600))
    if (rnd() < 0.05) tx(d, 'transport', 'Station Total', between(4500, 7000))
    if (day === 12) tx(d, 'enf-cantine', 'Cantine', between(6000, 8000))
    if (day === 18 && rnd() < 0.5) tx(d, 'coiffeuse', 'Coiffeuse', 3500)
    if (day === 22 && rnd() < 0.6) {
      const id = uid()
      const secuAt = d < addDays(t, -10) ? addDays(d, 5) : undefined
      s.transactions.push({ id, type: 'expense', amount: 3000, date: d, categoryId: 'sante-medecin', label: 'Dr Martin', createdAt: Date.now(), reimb: { secu: 1900, mutuelle: 900, secuAt } })
      if (secuAt) tx(secuAt, 'rembours', 'Remb. Sécu · Dr Martin', 1900, 'income', { reimbOf: id })
    }
  }
  // A suspicious duplicate & a price increase to show the detective
  tx(addDays(t, -3), 'shopping', 'Zalando', 5990)
  tx(addDays(t, -2), 'shopping', 'Zalando', 5990)
  for (let i = 3; i >= 1; i--) tx(addMonths(t, -i, 5), 'abonnements', 'Spotify', i === 1 ? 1299 : 1099)

  const rec = (label: string, categoryId: string, amount: number, day: number, type: 'expense' | 'income' = 'expense', autoPost = true) => {
    const r = { id: uid(), label, categoryId, amount, type, frequency: 'monthly' as const, startDate: addMonths(start, 0, day), autoPost }
    s.recurrings.push(r)
  }
  rec('Salaire', 'salaire', 245000, 28, 'income')
  // CAF waits for confirmation: only the latest payment is left pending, older ones are already in
  const lastCaf = t.slice(8) >= '05' ? `${t.slice(0, 8)}05` : addMonths(`${t.slice(0, 8)}05`, -1)
  for (let i = 3; i >= 1; i--) tx(addMonths(lastCaf, -i), 'caf', 'CAF', 31200, 'income')
  s.recurrings.push({ id: uid(), label: 'CAF', categoryId: 'caf', amount: 31200, type: 'income', frequency: 'monthly', startDate: lastCaf, autoPost: false })
  rec('Loyer', 'logement', 85000, 3)
  rec('Crédit voiture', 'credit-voiture', 21900, 10)
  rec('Matmut', 'matmut', 7450, 8)
  rec('Assurance lunettes', 'assu-lunettes', 890, 15)
  rec('Netflix', 'netflix', 1399, 20)
  rec('Crèche', 'enf-creche', 32000, 6)

  const p = currentPeriod()
  const env = (categoryId: string, amount: number) => s.envelopes.push({ id: uid(), categoryId, history: [{ from: shiftPeriod(p, -3), amount }], rollover: false })
  env('courses', 50000)
  env('boulangerie', 4000)
  env('resto', 8000)
  env('enfants', 50000)
  env('sorties', 6000)
  env('shopping', 6000)

  const gid = uid()
  s.goals.push({ id: gid, name: 'Vacances en Bretagne', emoji: '🏖️', color: '#a8d8ff', target: 200000, deadline: `${Number(t.slice(0, 4)) + 1}-07-01`, contributions: [{ id: uid(), date: addDays(t, -60), amount: 30000 }, { id: uid(), date: addDays(t, -30), amount: 25000 }], createdAt: Date.now() })
  s.goals.push({ id: uid(), name: "Fonds d'urgence", emoji: '🛟', color: '#9be3c4', target: 300000, contributions: [{ id: uid(), date: addDays(t, -20), amount: 120000 }], createdAt: Date.now() })

  const y = t.slice(0, 4)
  s.events.push({
    id: uid(),
    kind: 'christmas',
    name: `Noël ${y}`,
    emoji: '🎄',
    budget: 60000,
    date: `${y}-12-25`,
    people: [{ name: 'Léo', budget: 15000 }, { name: 'Mamie', budget: 5000 }, { name: 'Chéri·e', budget: 10000 }],
    gifts: [
      { id: uid(), person: 'Léo', title: 'Lego pompiers', price: 5999, status: 'toWrap' },
      { id: uid(), person: 'Léo', title: 'Livre de dinosaures', price: 1490, status: 'toBuy' },
      { id: uid(), person: 'Mamie', title: 'Plaid tout doux', price: 3500, status: 'idea' },
      { id: uid(), person: 'Chéri·e', title: 'Week-end surprise', price: 9000, status: 'ready' },
    ],
    items: [],
    checklist: [],
    autoLog: false,
    createdAt: Date.now(),
  })
  s.events.push({
    id: uid(),
    kind: 'trip',
    name: 'Vacances en Bretagne',
    emoji: '🏖️',
    budget: 200000,
    date: `${Number(y) + 1}-07-10`,
    people: [],
    gifts: [],
    items: [
      { id: uid(), title: 'Location maison', kind: 'logement', planned: 95000, paid: false },
      { id: uid(), title: 'Essence + péages', kind: 'transport', planned: 25000, paid: false },
      { id: uid(), title: 'Aquarium de Saint-Malo', kind: 'activite', planned: 8000, paid: false },
    ],
    checklist: [
      { id: uid(), text: 'Réserver la maison', done: true },
      { id: uid(), text: 'Crème solaire', done: false },
      { id: uid(), text: 'Doudou !!', done: false },
    ],
    autoLog: false,
    createdAt: Date.now(),
  })
  s.goals[0].eventId = s.events[1].id

  // Some streak history
  for (let i = 1; i <= 5; i++) s.game.checkins.push(addDays(t, -i))
  s.game.noSpendDays.push(addDays(t, -4))
  s.game.xp = 180
  return s
}
