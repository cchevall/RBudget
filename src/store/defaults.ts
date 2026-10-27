import type { AppState, Category } from './types'

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
  ['epargne', 'epargne'], ['livret', 'epargne'],
]

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
  }
}
