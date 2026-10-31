import type { AppState, Category, ImmoSettings, ProActivity, ProSettings } from './types'
import { addMonths, today } from '../lib/utils'

const c = (id: string, emoji: string, name: string, color: string, parentId?: string, kind: 'expense' | 'income' = 'expense'): Category => ({
  id,
  emoji,
  name,
  color,
  parentId,
  kind,
})

export const DEFAULT_CATEGORIES: Category[] = [
  // Revenus
  c('salaire', '💼', 'Salaire', '#9be3c4', undefined, 'income'),
  c('remuneration', '🧑‍💻', 'Rémunération pro', '#9be3c4', undefined, 'income'),
  c('caf', '👶', 'CAF', '#a8d8ff', undefined, 'income'),
  c('rembours', '💚', 'Remboursements santé', '#b8f0c8', undefined, 'income'),
  c('autres-revenus', '💰', 'Autres revenus', '#ffe08a', undefined, 'income'),

  // Quotidien
  c('courses', '🛒', 'Courses', '#ffb3c7'),
  c('boulangerie', '🥖', 'Boulangerie', '#ffd59e'),
  c('resto', '🍜', 'Resto', '#ffad9e'),

  // Enfants
  c('enfants', '🧸', 'Enfants', '#c9b6ff'),
  c('enf-habits', '👕', 'Habits', '#c9b6ff', 'enfants'),
  c('enf-activites', '🎨', 'Activités', '#c9b6ff', 'enfants'),
  c('enf-creche', '🍼', 'Crèche', '#c9b6ff', 'enfants'),
  c('enf-cantine', '🍽️', 'Cantine', '#c9b6ff', 'enfants'),
  c('enf-peri', '🏫', 'Périscolaire', '#c9b6ff', 'enfants'),
  c('enf-sante', '🩹', 'Santé enfants', '#c9b6ff', 'enfants'),

  // Santé
  c('sante', '🩺', 'Santé', '#9fe6e0'),
  c('sante-medecin', '👩‍⚕️', 'Médecin', '#9fe6e0', 'sante'),
  c('sante-kine', '💆', 'Kiné', '#9fe6e0', 'sante'),
  c('sante-osteo', '🦴', 'Ostéo', '#9fe6e0', 'sante'),
  c('sante-pharma', '💊', 'Pharmacie', '#9fe6e0', 'sante'),

  // Fixes
  c('logement', '🏠', 'Logement & énergie', '#ffc8a8'),
  c('credit-voiture', '🚗', 'Crédit voiture', '#a8c8ff'),
  c('matmut', '🛡️', 'Matmut', '#b0d0ff'),
  c('assu-lunettes', '👓', 'Assurance lunettes', '#bfe0ff'),
  c('abonnements', '📺', 'Abonnements', '#ffb0e0'),
  c('netflix', '🍿', 'Netflix', '#ffb0e0', 'abonnements'),
  c('telephone', '📱', 'Téléphone & box', '#ffb0e0', 'abonnements'),
  c('transport', '⛽', 'Transport & essence', '#d0d8e8'),

  // Plaisirs
  c('cadeaux', '🎁', 'Cadeaux', '#ff9ec0'),
  c('may', '💕', 'May', '#ffc0dd'),
  c('sorties', '🎡', 'Activités & sorties', '#ffd0a0'),
  c('coiffeuse', '💇', 'Coiffeuse', '#f0c0ff'),
  c('estheticienne', '💅', 'Esthéticienne', '#ffc0f0'),
  c('shopping', '🛍️', 'Shopping', '#ffcce0'),
  c('noel', '🎄', 'Noël', '#a8e6a0'),
  c('vacances', '🏖️', 'Vacances', '#a0e0ff'),

  // Épargne & divers
  c('impots', '🧾', 'Impôts', '#ffad9e'),
  c('epargne', '🐷', 'Épargne', '#ffb7cf'),
  c('divers', '✨', 'Divers', '#e0e0f0'),
]

/** Built-in keyword -> category dictionary used before the app has learned anything */
export const BUILTIN_RULES: [string, string][] = [
  ['carrefour', 'courses'], ['leclerc', 'courses'], ['lidl', 'courses'], ['auchan', 'courses'], ['intermarche', 'courses'],
  ['super u', 'courses'], ['monoprix', 'courses'], ['franprix', 'courses'], ['aldi', 'courses'], ['casino', 'courses'],
  ['picard', 'courses'], ['biocoop', 'courses'], ['grand frais', 'courses'], ['drive', 'courses'], ['courses', 'courses'],
  ['boulang', 'boulangerie'], ['pain', 'boulangerie'], ['baguette', 'boulangerie'], ['patisserie', 'boulangerie'], ['croissant', 'boulangerie'],
  ['resto', 'resto'], ['restaurant', 'resto'], ['mcdo', 'resto'], ['mcdonald', 'resto'], ['burger', 'resto'], ['kfc', 'resto'],
  ['pizza', 'resto'], ['sushi', 'resto'], ['deliveroo', 'resto'], ['uber eats', 'resto'], ['kebab', 'resto'], ['cafe', 'resto'],
  ['creche', 'enf-creche'], ['cantine', 'enf-cantine'], ['periscolaire', 'enf-peri'], ['garderie', 'enf-peri'], ['centre de loisirs', 'enf-peri'],
  ['kiabi', 'enf-habits'], ['vertbaudet', 'enf-habits'], ['okaidi', 'enf-habits'], ['tape a l oeil', 'enf-habits'],
  ['pediatre', 'enf-sante'],
  ['medecin', 'sante-medecin'], ['docteur', 'sante-medecin'], ['dr ', 'sante-medecin'], ['generaliste', 'sante-medecin'], ['dentiste', 'sante-medecin'],
  ['kine', 'sante-kine'], ['osteo', 'sante-osteo'], ['pharma', 'sante-pharma'],
  ['loyer', 'logement'], ['edf', 'logement'], ['engie', 'logement'], ['eau', 'logement'], ['total energie', 'logement'],
  ['credit auto', 'credit-voiture'], ['credit voiture', 'credit-voiture'], ['matmut', 'matmut'], ['lunettes', 'assu-lunettes'],
  ['netflix', 'netflix'], ['spotify', 'abonnements'], ['disney', 'abonnements'], ['deezer', 'abonnements'], ['prime video', 'abonnements'], ['canal', 'abonnements'],
  ['free', 'telephone'], ['orange', 'telephone'], ['sfr', 'telephone'], ['bouygues', 'telephone'], ['sosh', 'telephone'],
  ['essence', 'transport'], ['carburant', 'transport'], ['station', 'transport'], ['peage', 'transport'], ['sncf', 'transport'], ['parking', 'transport'],
  ['cadeau', 'cadeaux'], ['anniv', 'cadeaux'],
  ['cinema', 'sorties'], ['bowling', 'sorties'], ['parc', 'sorties'], ['piscine', 'sorties'], ['musee', 'sorties'],
  ['coiff', 'coiffeuse'], ['esthet', 'estheticienne'], ['ongles', 'estheticienne'], ['epil', 'estheticienne'],
  ['amazon', 'shopping'], ['zara', 'shopping'], ['h m', 'shopping'], ['primark', 'shopping'], ['decathlon', 'shopping'], ['action', 'shopping'],
  ['salaire', 'salaire'], ['paie', 'salaire'], ['caf', 'caf'], ['cpam', 'rembours'], ['ameli', 'rembours'], ['mutuelle', 'rembours'],
  ['impot', 'impots'], ['dgfip', 'impots'], ['prelevement a la source', 'impots'], ['taxe fonciere', 'impots'],
  ['epargne', 'epargne'], ['livret', 'epargne'],
]

/**
 * Micro-entrepreneur presets (2026). Every value stays editable in the pro settings:
 * rates change often, check urssaf.fr.
 */
export const ACTIVITIES: Record<ProActivity, { label: string; urssaf: number; cfp: number; vl: number; abattement: number; ceiling: number; tva: number }> = {
  bnc: { label: 'Libéral (BNC)', urssaf: 25.6, cfp: 0.2, vl: 2.2, abattement: 34, ceiling: 8360000, tva: 3750000 },
  'bic-services': { label: 'Prestations de services (BIC)', urssaf: 21.2, cfp: 0.3, vl: 1.7, abattement: 50, ceiling: 8360000, tva: 3750000 },
  'bic-vente': { label: 'Vente de marchandises (BIC)', urssaf: 12.3, cfp: 0.1, vl: 1, abattement: 71, ceiling: 20310000, tva: 8500000 },
}

export function activityDefaults(activity: ProActivity): Partial<ProSettings> {
  const a = ACTIVITIES[activity]
  return { activity, urssafRate: a.urssaf, cfpRate: a.cfp, vlRate: a.vl, abattement: a.abattement, ceiling: a.ceiling, tvaThreshold: a.tva }
}

export function defaultPro(): ProSettings {
  return {
    activity: 'bnc',
    urssafRate: 25.6,
    cfpRate: 0.2,
    vl: false,
    vlRate: 2.2,
    abattement: 34,
    declaration: 'monthly',
    reelRate: 45,
    ceiling: 8360000,
    tvaThreshold: 3750000,
    foreignClients: false,
    client: '',
    currency: 'EUR',
    fxRate: 1,
    invoiceAmount: 0,
    openingBalance: 0,
    openingDate: today(),
    cfe: 0,
    pasRate: 0,
    cushion: 0,
    bank: '',
  }
}

export function defaultImmo(): ImmoSettings {
  return {
    income: 0,
    coIncome: 0,
    credits: 0,
    maxDebt: 35,
    rate: 3.5,
    years: 25,
    savings: 0,
    monthlySavings: 0,
    coSavings: 0,
    sell: false,
    saleValue: 0,
    crd: 0,
    crdMonthly: 0,
    targetDate: addMonths(today(), 24, 1),
  }
}

export function defaultState(): AppState {
  return {
    version: 1,
    settings: {
      name: '',
      currency: 'EUR',
      monthStartDay: 1,
      theme: 'fraise',
      dark: 'auto',
      onboarded: false,
      sounds: true,
      profile: 'salarie',
    },
    categories: DEFAULT_CATEGORIES.map((x) => ({ ...x })),
    transactions: [],
    recurrings: [],
    pending: [],
    envelopes: [],
    goals: [],
    events: [],
    rules: [],
    game: { xp: 0, unlocked: {}, checkins: [], noSpendDays: [], claimedChallenges: [], flags: {} },
    pro: { settings: defaultPro(), invoices: [], expenses: [], recurrings: [] },
    immo: defaultImmo(),
  }
}
