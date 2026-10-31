import { computed, signal } from '@preact/signals'
import { get, set } from 'idb-keyval'
import type { AppState, Category, Contribution, EventBudget, Gift, GiftStatus, Goal, ID, Invoice, ProExpense, ProSettings, Recurring, Transaction, TripItem } from './types'
import { defaultState } from './defaults'
import { addDays, currentPeriod, periodRange, setCurrency, setStartDay, today, uid } from '../lib/utils'
import { occurrences } from '../lib/recurring'
import { learnRule } from '../lib/autocat'
import { checkAchievements, XP } from '../lib/game'

const KEY = 'mochi-budget-state'

export const state = signal<AppState>(defaultState())
export const loaded = signal(false)

// ---------- UI signals ----------

export interface Toast {
  id: string
  text: string
  emoji?: string
  action?: { label: string; run: () => void }
}
export const toasts = signal<Toast[]>([])
export function toast(text: string, emoji = '✨', action?: Toast['action']) {
  const t = { id: uid(), text, emoji, action }
  toasts.value = [...toasts.value, t]
  setTimeout(() => (toasts.value = toasts.value.filter((x) => x.id !== t.id)), action ? 5000 : 2600)
}

export interface Celebration {
  id: string
  emoji: string
  title: string
  text: string
}
export const celebrations = signal<Celebration[]>([])
export const xpFloat = signal<{ id: string; amount: number } | null>(null)
export const confettiTick = signal(0)
export const fireConfetti = () => (confettiTick.value = confettiTick.value + 1)

// ---------- Derived ----------

export const catMap = computed(() => new Map(state.value.categories.map((c) => [c.id, c])))
export const txMap = computed(() => new Map(state.value.transactions.map((t) => [t.id, t])))
export const cat = (id: ID): Category =>
  catMap.value.get(id) ?? { id, name: 'Inconnue', emoji: '❓', color: '#ddd', kind: 'expense' }

// ---------- Persistence ----------

let saveTimer: number | undefined
function persist() {
  clearTimeout(saveTimer)
  saveTimer = window.setTimeout(flush, 250)
}
export async function flush() {
  clearTimeout(saveTimer)
  try {
    await set(KEY, state.value)
  } catch (e) {
    // IndexedDB unavailable (private mode…): fall back to localStorage
    try {
      localStorage.setItem(KEY, JSON.stringify(state.value))
    } catch {}
  }
}
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush())

/** Brings old or partial saves up to the current shape */
function migrate(s: Partial<AppState>): AppState {
  const d = defaultState()
  const out = {
    ...d,
    ...s,
    settings: { ...d.settings, ...s.settings },
    game: { ...d.game, ...s.game },
    pro: { ...d.pro, ...s.pro, settings: { ...d.pro.settings, ...s.pro?.settings } },
    immo: { ...d.immo, ...s.immo },
  } as AppState
  // Add new default categories that may have appeared in later versions
  const ids = new Set(out.categories.map((c) => c.id))
  for (const c of d.categories) if (!ids.has(c.id)) out.categories.push(c)
  return out
}

export async function load() {
  let saved: AppState | undefined
  try {
    saved = await get(KEY)
  } catch {}
  if (!saved) {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) saved = JSON.parse(raw)
    } catch {}
  }
  state.value = migrate(saved ?? {})
  applySettings()
  runRecurrings()
  loaded.value = true
  navigator.storage?.persist?.().catch(() => {})
}

function applySettings() {
  setCurrency(state.value.settings.currency)
  setStartDay(state.value.settings.monthStartDay)
}

// ---------- Core update ----------

/** Mutates a clone of the state then publishes it. Gamification checks run after each change. */
export function update(fn: (s: AppState) => void, opts: { silent?: boolean } = {}) {
  const draft = structuredClone(state.value)
  fn(draft)
  if (!opts.silent) {
    const fresh = checkAchievements(draft)
    for (const a of fresh) {
      draft.game.xp += a.xp
      celebrations.value = [...celebrations.value, { id: a.id, emoji: a.emoji, title: a.title, text: a.desc }]
    }
  }
  state.value = draft
  applySettings()
  persist()
}

/** Loads a whole new state (restore, demo, reset). Already-earned achievements are unlocked without fanfare. */
export function replaceState(s: AppState) {
  state.value = migrate(s)
  applySettings()
  runRecurrings()
  update((d) => void checkAchievements(d), { silent: true })
}

function gainXp(s: AppState, n: number) {
  s.game.xp += n
  xpFloat.value = { id: uid(), amount: n }
}

function checkin(s: AppState, day = today()) {
  if (!s.game.checkins.includes(day)) {
    s.game.checkins.push(day)
    s.game.checkins.sort()
    gainXp(s, XP.checkin)
  }
}

// ---------- Transactions ----------

export type TxInput = Omit<Transaction, 'id' | 'createdAt'> & { id?: ID }

export function addTransaction(input: TxInput, opts: { learn?: boolean } = {}) {
  const tx: Transaction = { ...input, id: input.id ?? uid(), createdAt: Date.now() }
  update((s) => {
    s.transactions.push(tx)
    if (opts.learn !== false && tx.label) learnRule(s, tx.label, tx.categoryId)
    checkin(s)
    gainXp(s, XP.addTx)
  })
  return tx
}

export function updateTransaction(id: ID, patch: Partial<Transaction>) {
  update((s) => {
    const t = s.transactions.find((x) => x.id === id)
    if (!t) return
    Object.assign(t, patch)
    if (patch.categoryId && t.label) learnRule(s, t.label, patch.categoryId)
  })
}

export function deleteTransaction(id: ID) {
  const removed = state.value.transactions.find((t) => t.id === id)
  update(
    (s) => {
      s.transactions = s.transactions.filter((t) => t.id !== id && t.reimbOf !== id)
      // unlink from goals / events
      for (const g of s.goals) g.contributions = g.contributions.filter((c) => c.txId !== id)
      for (const e of s.events) {
        for (const g of e.gifts) if (g.txId === id) g.txId = undefined
        for (const i of e.items) if (i.txId === id) i.txId = undefined
      }
    },
    { silent: true },
  )
  if (removed)
    toast('Opération supprimée', '🗑️', {
      label: 'Annuler',
      run: () => update((s) => s.transactions.push(removed), { silent: true }),
    })
}

export function noSpendToday() {
  update((s) => {
    const d = today()
    if (!s.game.noSpendDays.includes(d)) s.game.noSpendDays.push(d)
    checkin(s)
    gainXp(s, XP.noSpend)
  })
  fireConfetti()
}

// ---------- Health reimbursements ----------

export function markReimbursed(txId: ID, part: 'secu' | 'mutuelle', amount: number) {
  update((s) => {
    const t = s.transactions.find((x) => x.id === txId)
    if (!t?.reimb) return
    const d = today()
    t.reimb[part] = amount
    if (part === 'secu') t.reimb.secuAt = d
    else t.reimb.mutuelleAt = d
    if (amount > 0)
      s.transactions.push({
        id: uid(),
        type: 'income',
        amount,
        date: d,
        categoryId: 'rembours',
        label: `Remb. ${part === 'secu' ? 'Sécu' : 'mutuelle'} · ${t.label || 'santé'}`,
        reimbOf: t.id,
        createdAt: Date.now(),
      })
    gainXp(s, XP.reimb)
  })
}

// ---------- Recurring ----------

/** Generates every occurrence due up to today: auto-posted or queued for confirmation */
export function runRecurrings() {
  const t = today()
  let posted = 0
  update(
    (s) => {
      for (const r of s.recurrings) {
        if (r.paused) continue
        const from = r.lastDate ? addDays(r.lastDate, 1) : r.startDate
        const due = occurrences(r, from, t)
        for (const date of due) {
          if (r.autoPost) {
            s.transactions.push({
              id: uid(),
              type: r.type,
              amount: r.amount,
              date,
              categoryId: r.categoryId,
              label: r.label,
              recurringId: r.id,
              createdAt: Date.now(),
            })
            posted++
          } else s.pending.push({ id: uid(), recurringId: r.id, date })
        }
        if (due.length) r.lastDate = due[due.length - 1]
      }
      for (const r of s.pro.recurrings) {
        if (r.paused) continue
        const due = occurrences(r, r.lastDate ? addDays(r.lastDate, 1) : r.startDate, t)
        for (const date of due) {
          s.pro.expenses.push({ id: uid(), date, label: r.label, amount: r.amount, kind: r.categoryId as ProExpense['kind'], recurringId: r.id, createdAt: Date.now() })
          posted++
        }
        if (due.length) r.lastDate = due[due.length - 1]
      }
    },
    { silent: true },
  )
  if (posted) toast(`${posted} opération${posted > 1 ? 's' : ''} récurrente${posted > 1 ? 's' : ''} ajoutée${posted > 1 ? 's' : ''} pour toi`, '🔁')
}

export function saveRecurring(r: Omit<Recurring, 'id'> & { id?: ID }) {
  update((s) => {
    const existing = r.id && s.recurrings.find((x) => x.id === r.id)
    if (existing) Object.assign(existing, r)
    else {
      // Occurrences before the current budget period are not backfilled
      const periodStart = periodRange(currentPeriod())[0]
      s.recurrings.push({ ...r, id: uid(), lastDate: r.startDate < periodStart ? addDays(periodStart, -1) : undefined })
    }
  })
  runRecurrings()
}

export function deleteRecurring(id: ID) {
  update((s) => {
    s.recurrings = s.recurrings.filter((r) => r.id !== id)
    s.pending = s.pending.filter((p) => p.recurringId !== id)
  })
}

export function confirmPending(pid: ID, amount: number) {
  const p = state.value.pending.find((x) => x.id === pid)
  const r = p && state.value.recurrings.find((x) => x.id === p.recurringId)
  if (!p || !r) return
  update((s) => {
    s.pending = s.pending.filter((x) => x.id !== pid)
    s.transactions.push({
      id: uid(),
      type: r.type,
      amount,
      date: p.date,
      categoryId: r.categoryId,
      label: r.label,
      recurringId: r.id,
      createdAt: Date.now(),
    })
    checkin(s)
    gainXp(s, XP.addTx)
  })
}
export const skipPending = (pid: ID) => update((s) => void (s.pending = s.pending.filter((x) => x.id !== pid)), { silent: true })

// ---------- Envelopes ----------

export function setEnvelope(categoryId: ID, amount: number, rollover: boolean, from: string) {
  update((s) => {
    let e = s.envelopes.find((x) => x.categoryId === categoryId)
    if (!e) {
      e = { id: uid(), categoryId, history: [], rollover }
      s.envelopes.push(e)
    }
    e.rollover = rollover
    e.history = e.history.filter((h) => h.from !== from)
    e.history.push({ from, amount })
    e.history.sort((a, b) => a.from.localeCompare(b.from))
  })
}
export const deleteEnvelope = (categoryId: ID) =>
  update((s) => void (s.envelopes = s.envelopes.filter((e) => e.categoryId !== categoryId)))

// ---------- Goals ----------

export function saveGoal(g: Partial<Goal> & { name: string; target: number }) {
  let id = g.id
  update((s) => {
    const existing = id && s.goals.find((x) => x.id === id)
    if (existing) Object.assign(existing, g)
    else {
      id = uid()
      s.goals.push({ emoji: '🎯', color: '#ffb7cf', contributions: [], createdAt: Date.now(), ...g, id })
    }
  })
  return id!
}
export const deleteGoal = (id: ID) => update((s) => void (s.goals = s.goals.filter((g) => g.id !== id)), { silent: true })

export const goalSaved = (g: Goal) => g.contributions.reduce((a, c) => a + c.amount, 0)

/** Positive amount = put money aside, negative = take some back. Optionally mirrored as an "Épargne" expense. */
export function contribute(goalId: ID, amount: number, asExpense: boolean, note?: string) {
  update((s) => {
    const g = s.goals.find((x) => x.id === goalId)
    if (!g) return
    const c: Contribution = { id: uid(), date: today(), amount, note }
    if (asExpense && amount !== 0) {
      const tx: Transaction = {
        id: uid(),
        type: amount > 0 ? 'expense' : 'income',
        amount: Math.abs(amount),
        date: c.date,
        categoryId: amount > 0 ? 'epargne' : 'autres-revenus',
        label: `${amount > 0 ? 'Épargne' : 'Retrait'} · ${g.name}`,
        goalId,
        createdAt: Date.now(),
      }
      s.transactions.push(tx)
      c.txId = tx.id
    }
    g.contributions.push(c)
    const before = goalSaved(g) - amount
    gainXp(s, XP.contribute)
    if (!g.doneAt && goalSaved(g) >= g.target && before < g.target) {
      g.doneAt = Date.now()
      gainXp(s, XP.goalDone)
      celebrations.value = [
        ...celebrations.value,
        { id: uid(), emoji: g.emoji, title: 'Objectif atteint !', text: `${g.name} : bravo, tu l'as fait ! 🎉` },
      ]
    }
  })
  fireConfetti()
}

// ---------- Events (Noël, vacances…) ----------

export function saveEvent(e: Partial<EventBudget> & { name: string; kind: EventBudget['kind'] }) {
  let id = e.id
  update((s) => {
    const existing = id && s.events.find((x) => x.id === id)
    if (existing) Object.assign(existing, e)
    else {
      id = uid()
      s.events.push({
        emoji: e.kind === 'christmas' ? '🎄' : e.kind === 'trip' ? '🏖️' : '🎉',
        budget: 0,
        people: [],
        gifts: [],
        items: [],
        checklist: [],
        autoLog: true,
        createdAt: Date.now(),
        ...e,
        id,
      })
    }
  })
  return id!
}
export const deleteEvent = (id: ID) => update((s) => void (s.events = s.events.filter((e) => e.id !== id)), { silent: true })

export function mutateEvent(id: ID, fn: (e: EventBudget, s: AppState) => void) {
  update((s) => {
    const e = s.events.find((x) => x.id === id)
    if (e) fn(e, s)
  })
}

const eventCategory = (e: EventBudget) => (e.kind === 'christmas' ? 'noel' : e.kind === 'trip' ? 'vacances' : 'divers')

/** Keeps the linked expense in sync with a gift / trip item */
function syncLinkedTx(s: AppState, e: EventBudget, item: { txId?: ID }, active: boolean, amount: number, label: string) {
  if (!e.autoLog) return
  const existing = item.txId && s.transactions.find((t) => t.id === item.txId)
  if (active && amount > 0) {
    if (existing) {
      existing.amount = amount
      existing.label = label
    } else {
      const tx: Transaction = {
        id: uid(),
        type: 'expense',
        amount,
        date: today(),
        categoryId: eventCategory(e),
        label,
        eventId: e.id,
        createdAt: Date.now(),
      }
      s.transactions.push(tx)
      item.txId = tx.id
    }
  } else if (existing) {
    s.transactions = s.transactions.filter((t) => t.id !== existing.id)
    item.txId = undefined
  }
}

export const GIFT_FLOW: GiftStatus[] = ['idea', 'toBuy', 'toWrap', 'ready']
/** A gift is bought once it's waiting to be wrapped or ready */
export const giftBought = (g: Gift) => g.status === 'toWrap' || g.status === 'ready'

export function saveGift(eventId: ID, gift: Gift) {
  mutateEvent(eventId, (e, s) => {
    const i = e.gifts.findIndex((g) => g.id === gift.id)
    const target = i >= 0 ? Object.assign(e.gifts[i], gift) : (e.gifts.push(gift), gift)
    syncLinkedTx(s, e, target, giftBought(target), target.price, `🎁 ${target.title} pour ${target.person}`)
    if (target.status === 'ready') gainXp(s, XP.giftReady)
  })
}
export function deleteGift(eventId: ID, giftId: ID) {
  mutateEvent(eventId, (e, s) => {
    const g = e.gifts.find((x) => x.id === giftId)
    if (g) syncLinkedTx(s, e, g, false, 0, '')
    e.gifts = e.gifts.filter((x) => x.id !== giftId)
  })
}

export function saveTripItem(eventId: ID, item: TripItem) {
  mutateEvent(eventId, (e, s) => {
    const i = e.items.findIndex((x) => x.id === item.id)
    const target = i >= 0 ? Object.assign(e.items[i], item) : (e.items.push(item), item)
    syncLinkedTx(s, e, target, target.paid, target.actual ?? target.planned, `${e.emoji} ${target.title}`)
  })
}
export function deleteTripItem(eventId: ID, itemId: ID) {
  mutateEvent(eventId, (e, s) => {
    const it = e.items.find((x) => x.id === itemId)
    if (it) syncLinkedTx(s, e, it, false, 0, '')
    e.items = e.items.filter((x) => x.id !== itemId)
  })
}

// ---------- Categories ----------

export function saveCategory(c: Partial<Category> & { name: string; kind: Category['kind'] }) {
  update((s) => {
    const existing = c.id && s.categories.find((x) => x.id === c.id)
    if (existing) Object.assign(existing, c)
    else s.categories.push({ emoji: '✨', color: '#e0e0f0', ...c, id: uid() })
  }, { silent: true })
}

// ---------- Auto-entrepreneur ----------

export const setPro = (patch: Partial<ProSettings>) => update((s) => void Object.assign(s.pro.settings, patch), { silent: true })

export function saveInvoice(i: Omit<Invoice, 'id' | 'createdAt'> & { id?: ID }) {
  update((s) => {
    const existing = i.id && s.pro.invoices.find((x) => x.id === i.id)
    if (existing) Object.assign(existing, i)
    else s.pro.invoices.push({ ...i, id: uid(), createdAt: Date.now() })
    learnFx(s, i)
    checkin(s)
  })
}

/** Remembers the last exchange rate actually obtained, to estimate the next invoices */
function learnFx(s: AppState, i: Pick<Invoice, 'currency' | 'amount' | 'received'>) {
  const p = s.pro.settings
  if (i.received && i.amount && i.currency !== 'EUR' && i.currency === p.currency) p.fxRate = Math.round((i.received / i.amount) * 10000) / 10000
}

export function markInvoicePaid(id: ID, paidAt: string, received: number, declared?: number) {
  update((s) => {
    const i = s.pro.invoices.find((x) => x.id === id)
    if (!i) return
    Object.assign(i, { paidAt, received, declared: declared && declared !== received ? declared : undefined })
    learnFx(s, i)
    checkin(s)
    gainXp(s, XP.addTx)
  })
  fireConfetti()
}

export function deleteInvoice(id: ID) {
  const removed = state.value.pro.invoices.find((x) => x.id === id)
  update((s) => void (s.pro.invoices = s.pro.invoices.filter((x) => x.id !== id)), { silent: true })
  if (removed) toast('Facture supprimée', '🗑️', { label: 'Annuler', run: () => update((s) => s.pro.invoices.push(removed), { silent: true }) })
}

export function saveProExpense(e: Omit<ProExpense, 'id' | 'createdAt'> & { id?: ID }) {
  update((s) => {
    const existing = e.id && s.pro.expenses.find((x) => x.id === e.id)
    if (existing) Object.assign(existing, e)
    else s.pro.expenses.push({ ...e, id: uid(), createdAt: Date.now() })
    checkin(s)
  })
}

export function deleteProExpense(id: ID) {
  const removed = state.value.pro.expenses.find((x) => x.id === id)
  update((s) => void (s.pro.expenses = s.pro.expenses.filter((x) => x.id !== id)), { silent: true })
  if (removed) toast('Dépense supprimée', '🗑️', { label: 'Annuler', run: () => update((s) => s.pro.expenses.push(removed), { silent: true }) })
}

export function saveProRecurring(r: Omit<Recurring, 'id'> & { id?: ID }) {
  update((s) => {
    const existing = r.id && s.pro.recurrings.find((x) => x.id === r.id)
    if (existing) Object.assign(existing, r)
    else {
      const from = s.pro.settings.openingDate
      s.pro.recurrings.push({ ...r, id: uid(), lastDate: r.startDate < from ? addDays(from, -1) : undefined })
    }
  })
  runRecurrings()
}

export const deleteProRecurring = (id: ID) => update((s) => void (s.pro.recurrings = s.pro.recurrings.filter((r) => r.id !== id)), { silent: true })
