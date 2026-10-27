export type ID = string
/** Amounts are always stored in cents, positive. The sign comes from `type`. */
export type Cents = number
/** ISO date YYYY-MM-DD */
export type DateStr = string
/** Budget period key YYYY-MM (the period starting at `monthStartDay` of that month) */
export type PeriodKey = string

export type TxType = 'expense' | 'income'

export interface Category {
  id: ID
  name: string
  emoji: string
  color: string
  kind: TxType
  parentId?: ID
  archived?: boolean
}

export interface Reimbursement {
  secu: Cents
  mutuelle: Cents
  secuAt?: DateStr
  mutuelleAt?: DateStr
}

export interface Transaction {
  id: ID
  type: TxType
  amount: Cents
  date: DateStr
  categoryId: ID
  label: string
  note?: string
  recurringId?: ID
  goalId?: ID
  eventId?: ID
  /** Health expense waiting for Sécu / mutuelle refund */
  reimb?: Reimbursement
  /** Income created when a reimbursement arrives, points to the original expense */
  reimbOf?: ID
  imported?: boolean
  createdAt: number
}

export type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export interface Recurring {
  id: ID
  label: string
  type: TxType
  amount: Cents
  categoryId: ID
  frequency: Frequency
  /** First occurrence; following ones are derived from it */
  startDate: DateStr
  endDate?: DateStr
  /** true = posted automatically, false = waits for a one-tap confirmation (amount may vary, e.g. CAF) */
  autoPost: boolean
  /** Date of the last occurrence already generated */
  lastDate?: DateStr
  paused?: boolean
}

export interface PendingOccurrence {
  id: ID
  recurringId: ID
  date: DateStr
}

export interface Envelope {
  id: ID
  categoryId: ID
  /** Amount history so past months keep the budget they had */
  history: { from: PeriodKey; amount: Cents }[]
  /** Unspent money carries over to next month */
  rollover: boolean
}

export interface Contribution {
  id: ID
  date: DateStr
  amount: Cents
  note?: string
  txId?: ID
}

export interface Goal {
  id: ID
  name: string
  emoji: string
  color: string
  target: Cents
  deadline?: DateStr
  contributions: Contribution[]
  createdAt: number
  doneAt?: number
  eventId?: ID
  archived?: boolean
}

export type GiftStatus = 'idea' | 'toBuy' | 'toWrap' | 'ready'

export interface Gift {
  id: ID
  person: string
  title: string
  price: Cents
  status: GiftStatus
  where?: string
  txId?: ID
}

export interface TripItem {
  id: ID
  title: string
  kind: 'transport' | 'logement' | 'activite' | 'repas' | 'autre'
  planned: Cents
  actual?: Cents
  paid: boolean
  txId?: ID
}

export interface CheckItem {
  id: ID
  text: string
  done: boolean
}

export interface EventBudget {
  id: ID
  kind: 'christmas' | 'trip' | 'custom'
  name: string
  emoji: string
  budget: Cents
  date?: DateStr
  people: { name: string; budget: Cents }[]
  gifts: Gift[]
  items: TripItem[]
  checklist: CheckItem[]
  /** Paid items / bought gifts are automatically logged as expenses */
  autoLog: boolean
  createdAt: number
  archived?: boolean
}

export interface Rule {
  /** normalized keyword found in a label */
  key: string
  categoryId: ID
  hits: number
}

export interface GameState {
  xp: number
  unlocked: Record<string, number>
  /** Days (DateStr) where the user checked in: logged something or declared a no-spend day */
  checkins: DateStr[]
  noSpendDays: DateStr[]
  claimedChallenges: string[]
  /** One-off actions worth rewarding: backup, ai prompt, csv import… (timestamp) */
  flags: Record<string, number>
}

export type ThemeName = 'fraise' | 'menthe' | 'lavande' | 'peche' | 'citron'

export interface Settings {
  name: string
  currency: string
  monthStartDay: number
  theme: ThemeName
  dark: 'auto' | 'light' | 'dark'
  pinHash?: string
  lastBackup?: number
  onboarded: boolean
  sounds: boolean
}

export interface AppState {
  version: number
  settings: Settings
  categories: Category[]
  transactions: Transaction[]
  recurrings: Recurring[]
  pending: PendingOccurrence[]
  envelopes: Envelope[]
  goals: Goal[]
  events: EventBudget[]
  rules: Rule[]
  game: GameState
}
