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

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

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

// ---------- Auto-entrepreneur ----------

export type Profile = 'salarie' | 'ae'
export type ProActivity = 'bnc' | 'bic-services' | 'bic-vente'
export type ProKind = 'urssaf' | 'cfe' | 'banque' | 'assurance' | 'logiciels' | 'materiel' | 'deplacement' | 'formation' | 'comptable' | 'impots' | 'autre'

export interface ProSettings {
  activity: ProActivity
  /** Rates in % of the cashed-in turnover (micro regime) */
  urssafRate: number
  cfpRate: number
  /** Versement libératoire de l'impôt sur le revenu */
  vl: boolean
  vlRate: number
  /** Flat allowance used for the taxable income in micro (34% BNC) */
  abattement: number
  declaration: 'monthly' | 'quarterly'
  /** Switch to the "réel" regime on that date (micro before) */
  reelFrom?: DateStr
  /** Rough social contributions at réel, in % of (turnover - expenses) */
  reelRate: number
  ceiling: Cents
  tvaThreshold: Cents
  /** Only foreign B2B clients: services are outside French VAT */
  foreignClients: boolean
  client: string
  /** Invoicing currency and its estimated value in EUR (learnt from payments) */
  currency: string
  fxRate: number
  invoiceAmount: Cents
  /** Pro account balance on `openingDate`: the treasury is computed from there */
  openingBalance: Cents
  openingDate: DateStr
  /** Estimated yearly CFE, kept aside until paid */
  cfe: Cents
  /** Household withholding tax rate (%), used to estimate income tax */
  pasRate: number
  /** Money always left on the pro account */
  cushion: Cents
  bank: string
}

export interface Invoice {
  id: ID
  number: string
  client: string
  date: DateStr
  currency: string
  /** In the invoice currency */
  amount: Cents
  paidAt?: DateStr
  /** EUR actually credited on the pro account */
  received?: Cents
  /** EUR declared to the URSSAF (defaults to received) */
  declared?: Cents
  note?: string
  createdAt: number
}

export interface ProExpense {
  id: ID
  date: DateStr
  label: string
  amount: Cents
  kind: ProKind
  /** URSSAF payment: the declaration period it settles (YYYY-MM or YYYY-Tn) */
  urssafPeriod?: string
  recurringId?: ID
  note?: string
  createdAt: number
}

export interface ProState {
  settings: ProSettings
  invoices: Invoice[]
  expenses: ProExpense[]
  /** Fixed pro charges; `categoryId` holds a ProKind */
  recurrings: Recurring[]
}

export interface ImmoSettings {
  /** Net monthly income retained by the bank (0 = estimated from the app) */
  income: Cents
  coIncome: Cents
  /** Monthly loan payments that will still run after the purchase */
  credits: Cents
  maxDebt: number
  rate: number
  years: number
  savings: Cents
  monthlySavings: Cents
  coSavings: Cents
  sell: boolean
  saleValue: Cents
  /** Remaining capital on the current mortgage and capital repaid each month */
  crd: Cents
  crdMonthly: Cents
  targetDate: DateStr
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
  profile: Profile
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
  pro: ProState
  immo: ImmoSettings
}
