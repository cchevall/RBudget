import type { AppState, DateStr, ThemeName } from '../store/types'
import { addDays, currentPeriod, parseDate, shiftPeriod, toDateStr, today } from './utils'
import { envelopeStatus, totals, txOfPeriod } from './stats'
import { DEFAULT_CATEGORIES } from '../store/defaults'

const DEFAULT_IDS = new Set(DEFAULT_CATEGORIES.map((c) => c.id))

export const XP = {
  addTx: 5,
  checkin: 10,
  noSpend: 15,
  contribute: 10,
  goalDone: 150,
  reimb: 10,
  giftReady: 5,
}

// ---------- Levels ----------

const LEVEL_NAMES = [
  'Graine de sou', 'Petit bourgeon', 'Tirelire en herbe', 'Écureuil malin', 'Panda économe',
  'Chaton prévoyant', 'Lapin stratège', 'Renard futé', 'Hibou sage', 'Licorne du budget',
  'Dragon des finances', 'Reine des enveloppes', 'Mochi légendaire',
]

export const xpForLevel = (n: number) => 50 * (n - 1) * n
export function levelOf(xp: number) {
  let lvl = 1
  while (xp >= xpForLevel(lvl + 1)) lvl++
  const base = xpForLevel(lvl)
  const next = xpForLevel(lvl + 1)
  return { level: lvl, name: LEVEL_NAMES[Math.min(lvl - 1, LEVEL_NAMES.length - 1)], progress: (xp - base) / (next - base), toNext: next - xp }
}

export const THEMES: { id: ThemeName; name: string; emoji: string; level: number; color: string }[] = [
  { id: 'fraise', name: 'Fraise', emoji: '🍓', level: 1, color: '#ff8fb5' },
  { id: 'menthe', name: 'Menthe', emoji: '🌿', level: 2, color: '#5fd0a8' },
  { id: 'lavande', name: 'Lavande', emoji: '🪻', level: 3, color: '#a68bff' },
  { id: 'peche', name: 'Pêche', emoji: '🍑', level: 5, color: '#ff9f7a' },
  { id: 'citron', name: 'Citron', emoji: '🍋', level: 7, color: '#f2c230' },
]

// ---------- Streak ----------

export function streak(days: DateStr[]) {
  const set = new Set(days)
  let d = today()
  if (!set.has(d)) d = addDays(d, -1)
  let n = 0
  while (set.has(d)) {
    n++
    d = addDays(d, -1)
  }
  return n
}
export function bestStreak(days: DateStr[]) {
  const sorted = [...new Set(days)].sort()
  let best = 0
  let cur = 0
  let prev = ''
  for (const d of sorted) {
    cur = prev && addDays(prev, 1) === d ? cur + 1 : 1
    best = Math.max(best, cur)
    prev = d
  }
  return best
}

// ---------- Achievements ----------

export interface Achievement {
  id: string
  emoji: string
  title: string
  desc: string
  xp: number
  secret?: boolean
  /** [current, target] */
  progress: (s: AppState) => [number, number]
}

const count = (n: number, target: number): [number, number] => [Math.min(n, target), target]
const bool = (b: boolean): [number, number] => [b ? 1 : 0, 1]

function lastPeriodPerfect(s: AppState) {
  if (s.envelopes.length < 3) return false
  const p = shiftPeriod(currentPeriod(), -1)
  if (!txOfPeriod(s, p).length) return false
  return s.envelopes.every((e) => {
    const st = envelopeStatus(s, e, p)
    return st.budget > 0 && st.left >= 0
  })
}
function lastSavingsRate(s: AppState) {
  const t = totals(s, shiftPeriod(currentPeriod(), -1))
  return t.income > 0 ? t.savingsRate : 0
}
const hourOf = (ts: number) => new Date(ts).getHours()

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-tx', emoji: '🐣', title: 'Premier pas', desc: 'Enregistrer ta première opération', xp: 20, progress: (s) => count(s.transactions.length, 1) },
  { id: 'tx-50', emoji: '🐜', title: 'Petite fourmi', desc: '50 opérations enregistrées', xp: 50, progress: (s) => count(s.transactions.length, 50) },
  { id: 'tx-200', emoji: '📒', title: 'Carnet bien rempli', desc: '200 opérations enregistrées', xp: 100, progress: (s) => count(s.transactions.length, 200) },
  { id: 'tx-1000', emoji: '🦄', title: 'Légende du budget', desc: '1000 opérations enregistrées', xp: 300, progress: (s) => count(s.transactions.length, 1000) },
  { id: 'streak-3', emoji: '🔥', title: 'Ça chauffe', desc: '3 jours de suite', xp: 30, progress: (s) => count(bestStreak(s.game.checkins), 3) },
  { id: 'streak-7', emoji: '🌈', title: 'Une semaine pile', desc: '7 jours de suite', xp: 70, progress: (s) => count(bestStreak(s.game.checkins), 7) },
  { id: 'streak-30', emoji: '🌸', title: "Ça devient une habitude", desc: '30 jours de suite', xp: 200, progress: (s) => count(bestStreak(s.game.checkins), 30) },
  { id: 'streak-100', emoji: '💯', title: 'Centenaire', desc: '100 jours de suite', xp: 500, progress: (s) => count(bestStreak(s.game.checkins), 100) },
  { id: 'nospend-1', emoji: '🧘', title: 'Journée zen', desc: 'Une journée sans dépense', xp: 20, progress: (s) => count(s.game.noSpendDays.length, 1) },
  { id: 'nospend-10', emoji: '🍵', title: 'Maître zen', desc: '10 journées sans dépense', xp: 100, progress: (s) => count(s.game.noSpendDays.length, 10) },
  { id: 'nospend-50', emoji: '🪷', title: 'Nirvana', desc: '50 journées sans dépense', xp: 300, progress: (s) => count(s.game.noSpendDays.length, 50) },
  { id: 'envelope-1', emoji: '✉️', title: 'Première enveloppe', desc: 'Créer une enveloppe de budget', xp: 20, progress: (s) => count(s.envelopes.length, 1) },
  { id: 'envelopes-6', emoji: '🗂️', title: 'Tout bien rangé', desc: '6 enveloppes actives', xp: 50, progress: (s) => count(s.envelopes.length, 6) },
  { id: 'month-green', emoji: '🏆', title: 'Mois parfait', desc: 'Respecter toutes ses enveloppes sur un mois (min. 3)', xp: 200, progress: (s) => bool(lastPeriodPerfect(s)) },
  { id: 'saver-10', emoji: '🐷', title: 'Petit cochon', desc: "Épargner 10% de ses revenus sur un mois", xp: 80, progress: (s) => bool(lastSavingsRate(s) >= 0.1) },
  { id: 'saver-20', emoji: '🐿️', title: 'Écureuil', desc: "Épargner 20% de ses revenus sur un mois", xp: 150, progress: (s) => bool(lastSavingsRate(s) >= 0.2) },
  { id: 'goal-1', emoji: '💭', title: 'Des rêves plein la tête', desc: 'Créer un objectif', xp: 20, progress: (s) => count(s.goals.length, 1) },
  { id: 'goal-half', emoji: '🌗', title: 'À mi-chemin', desc: 'Un objectif rempli à 50%', xp: 60, progress: (s) => bool(s.goals.some((g) => g.target > 0 && g.contributions.reduce((a, c) => a + c.amount, 0) >= g.target / 2)) },
  { id: 'goal-done', emoji: '🎯', title: 'Dans le mille', desc: 'Atteindre un objectif', xp: 100, progress: (s) => bool(s.goals.some((g) => g.doneAt)) },
  { id: 'recurring-3', emoji: '🤖', title: 'Pilote automatique', desc: '3 opérations récurrentes', xp: 40, progress: (s) => count(s.recurrings.length, 3) },
  { id: 'christmas', emoji: '🧝', title: 'Lutin parfait', desc: "Tous les cadeaux de Noël prêts (min. 3)", xp: 120, progress: (s) => bool(s.events.some((e) => e.kind === 'christmas' && e.gifts.length >= 3 && e.gifts.every((g) => g.status === 'ready'))) },
  { id: 'trip', emoji: '🧳', title: 'Valises bouclées', desc: 'Checklist de vacances complète (min. 5)', xp: 80, progress: (s) => bool(s.events.some((e) => e.checklist.length >= 5 && e.checklist.every((c) => c.done))) },
  { id: 'reimb', emoji: '💚', title: 'Sécu-rité', desc: 'Suivre un remboursement santé jusqu’au bout', xp: 40, progress: (s) => bool(s.transactions.some((t) => t.reimb && t.reimb.secuAt && (t.reimb.mutuelleAt || !t.reimb.mutuelle))) },
  { id: 'backup', emoji: '💾', title: 'Esprit prudent', desc: 'Faire une sauvegarde', xp: 30, progress: (s) => bool(!!s.settings.lastBackup) },
  { id: 'ai', emoji: '🔮', title: 'Boule de cristal', desc: 'Générer un prompt pour ton coach IA', xp: 30, progress: (s) => bool(!!s.game.flags.ai) },
  { id: 'csv', emoji: '📥', title: 'Import express', desc: 'Importer un relevé bancaire', xp: 40, progress: (s) => bool(!!s.game.flags.csv) },
  { id: 'detective', emoji: '🕵️', title: 'Détective', desc: 'Consulter les trucs louches détectés', xp: 20, progress: (s) => bool(!!s.game.flags.detective) },
  { id: 'custom-cat', emoji: '🎨', title: 'Âme créative', desc: 'Créer ta propre catégorie', xp: 20, progress: (s) => bool(s.categories.some((c) => !DEFAULT_IDS.has(c.id))) },
  { id: 'early', emoji: '🌅', title: 'Lève-tôt', desc: 'Noter une dépense avant 7h', xp: 20, secret: true, progress: (s) => bool(s.transactions.some((t) => !t.imported && !t.recurringId && hourOf(t.createdAt) < 7)) },
  { id: 'owl', emoji: '🦉', title: 'Oiseau de nuit', desc: 'Noter une dépense après 23h', xp: 20, secret: true, progress: (s) => bool(s.transactions.some((t) => !t.imported && !t.recurringId && hourOf(t.createdAt) >= 23)) },
  { id: 'challenge-1', emoji: '🥇', title: 'Défi relevé', desc: 'Réussir un défi de la semaine', xp: 30, progress: (s) => count(s.game.claimedChallenges.length, 1) },
  { id: 'challenge-10', emoji: '🏅', title: 'Accro aux défis', desc: 'Réussir 10 défis', xp: 150, progress: (s) => count(s.game.claimedChallenges.length, 10) },
  { id: 'level-5', emoji: '⭐', title: 'Étoile montante', desc: 'Atteindre le niveau 5', xp: 0, progress: (s) => count(levelOf(s.game.xp).level, 5) },
  { id: 'level-10', emoji: '👑', title: 'Couronne dorée', desc: 'Atteindre le niveau 10', xp: 0, progress: (s) => count(levelOf(s.game.xp).level, 10) },
]

/** Marks newly completed achievements as unlocked and returns them */
export function checkAchievements(s: AppState): Achievement[] {
  const fresh: Achievement[] = []
  for (const a of ACHIEVEMENTS) {
    if (s.game.unlocked[a.id]) continue
    const [cur, max] = a.progress(s)
    if (cur >= max) {
      s.game.unlocked[a.id] = Date.now()
      fresh.push(a)
    }
  }
  return fresh
}

// ---------- Weekly challenges ----------

export interface Challenge {
  id: string
  emoji: string
  title: string
  desc: string
  xp: number
  /** atMost challenges can only be claimed on the last day of the week */
  kind: 'atLeast' | 'atMost'
  target: number
  measure: (s: AppState, from: DateStr, to: DateStr) => number
  unit?: 'money'
}

const txIn = (s: AppState, from: DateStr, to: DateStr) => s.transactions.filter((t) => t.date >= from && t.date <= to)
const countIn = (s: AppState, from: DateStr, to: DateStr, cats: string[]) =>
  txIn(s, from, to).filter((t) => t.type === 'expense' && cats.includes(t.categoryId)).length
const spentIn = (s: AppState, from: DateStr, to: DateStr, cats: string[]) =>
  txIn(s, from, to).filter((t) => t.type === 'expense' && cats.includes(t.categoryId)).reduce((a, t) => a + t.amount, 0)

const CHALLENGES: Challenge[] = [
  { id: 'nospend3', emoji: '🧘', title: '3 jours zen', desc: 'Déclare 3 journées sans dépense', xp: 60, kind: 'atLeast', target: 3, measure: (s, a, b) => s.game.noSpendDays.filter((d) => d >= a && d <= b).length },
  { id: 'checkin5', emoji: '📆', title: 'Fidèle au poste', desc: 'Ouvre et note tes dépenses 5 jours', xp: 50, kind: 'atLeast', target: 5, measure: (s, a, b) => s.game.checkins.filter((d) => d >= a && d <= b).length },
  { id: 'save20', emoji: '🐷', title: 'Petite pièce', desc: 'Mets au moins 20 € de côté sur un objectif', xp: 50, kind: 'atLeast', target: 2000, unit: 'money', measure: (s, a, b) => s.goals.flatMap((g) => g.contributions).filter((c) => c.date >= a && c.date <= b).reduce((x, c) => x + c.amount, 0) },
  { id: 'resto1', emoji: '🍜', title: 'Chef à la maison', desc: 'Pas plus d’un resto cette semaine', xp: 60, kind: 'atMost', target: 1, measure: (s, a, b) => countIn(s, a, b, ['resto']) },
  { id: 'boul3', emoji: '🥖', title: 'Croissant raisonnable', desc: 'Maximum 3 passages à la boulangerie', xp: 40, kind: 'atMost', target: 3, measure: (s, a, b) => countIn(s, a, b, ['boulangerie']) },
  { id: 'shop0', emoji: '🛍️', title: 'Pas de shopping', desc: '0 € de shopping cette semaine', xp: 60, kind: 'atMost', target: 0, unit: 'money', measure: (s, a, b) => spentIn(s, a, b, ['shopping']) },
  { id: 'log10', emoji: '✍️', title: 'Scribe appliqué', desc: 'Note 10 opérations cette semaine', xp: 40, kind: 'atLeast', target: 10, measure: (s, a, b) => txIn(s, a, b).filter((t) => !t.recurringId && !t.imported).length },
  { id: 'sorties', emoji: '🏡', title: 'Cocooning', desc: 'Sorties à 30 € maximum', xp: 40, kind: 'atMost', target: 3000, unit: 'money', measure: (s, a, b) => spentIn(s, a, b, ['sorties']) },
]

/** Monday..Sunday of the current week */
export function weekRange(d = today()): [DateStr, DateStr] {
  const date = parseDate(d)
  const dow = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - dow)
  const start = toDateStr(date)
  return [start, addDays(start, 6)]
}

export function weeklyChallenges(): (Challenge & { key: string })[] {
  const [start] = weekRange()
  const seed = start.split('-').reduce((a, x) => a * 31 + Number(x), 7)
  const a = seed % CHALLENGES.length
  let b = (seed * 7 + 3) % CHALLENGES.length
  if (b === a) b = (b + 1) % CHALLENGES.length
  return [CHALLENGES[a], CHALLENGES[b]].map((c) => ({ ...c, key: `${start}:${c.id}` }))
}

export function challengeState(s: AppState, c: Challenge & { key: string }) {
  const [a, b] = weekRange()
  const value = c.measure(s, a, b)
  const claimed = s.game.claimedChallenges.includes(c.key)
  const lastDay = today() === b
  const done = c.kind === 'atLeast' ? value >= c.target : value <= c.target
  const claimable = !claimed && done && (c.kind === 'atLeast' || lastDay)
  const progress = c.kind === 'atLeast' ? Math.min(1, value / c.target) : done ? 1 : 0
  return { value, claimed, claimable, done, progress, failed: c.kind === 'atMost' && !done }
}

// ---------- Mascot mood ----------

export type Mood = 'happy' | 'love' | 'worried' | 'sleepy' | 'party'

export function mascotMood(s: AppState): { mood: Mood; line: string } {
  const p = currentPeriod()
  const st = s.envelopes.map((e) => envelopeStatus(s, e, p))
  const over = st.filter((x) => x.left < 0)
  const str = streak(s.game.checkins)
  const name = s.settings.name ? ` ${s.settings.name}` : ''
  const h = new Date().getHours()
  if (!s.game.checkins.includes(today()) && h >= 21) return { mood: 'sleepy', line: `Avant dodo${name}, on note la journée ? 🌙` }
  if (over.length >= 2) return { mood: 'worried', line: `Oups, ${over.length} enveloppes dépassées… on rééquilibre ensemble ?` }
  if (over.length === 1) return { mood: 'worried', line: `Une enveloppe a débordé, rien de grave, on ajuste 💪` }
  if (str >= 7) return { mood: 'party', line: `${str} jours de suite${name} ! Tu es incroyable ✨` }
  if (s.game.checkins.includes(today())) return { mood: 'love', line: pick([`Journée notée, bravo${name} 💕`, 'Ton budget te dit merci 🍡', 'Mochi est fier de toi !']) }
  return { mood: 'happy', line: pick([`Coucou${name} ! Qu'as-tu dépensé aujourd'hui ?`, 'Un petit check du jour ? 30 secondes chrono ⏱️', 'On vise une journée zen ? 🧘']) }
}

function pick<T>(a: T[]): T {
  // stable per hour so it doesn't flicker on re-render
  return a[new Date().getHours() % a.length]
}
