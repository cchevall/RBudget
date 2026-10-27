import type { AppState } from '../store/types'
import { FREQ_LABEL, monthlyEquivalent } from './recurring'
import { envelopeStatus, history, spentByTop, topCategory } from './stats'
import { computeInsights } from './insights'
import { currentPeriod, money, periodLabel, periodRange, shiftPeriod, today } from './utils'
import { goalSaved } from '../store/store'

export interface PromptOptions {
  months: number
  details: boolean
  anonymize: boolean
  focus: { savings: boolean; suspicious: boolean; subscriptions: boolean; projects: boolean; kids: boolean }
  question: string
}

export const DEFAULT_PROMPT_OPTIONS: PromptOptions = {
  months: 3,
  details: true,
  anonymize: false,
  focus: { savings: true, suspicious: true, subscriptions: true, projects: true, kids: false },
  question: '',
}

const eur = (c: number) => money(Math.round(c), { exact: true })

export function buildPrompt(s: AppState, o: PromptOptions) {
  const cur = currentPeriod()
  const first = shiftPeriod(cur, -(o.months - 1))
  const [from] = periodRange(first)
  const catName = (id: string) => {
    const c = s.categories.find((x) => x.id === id)
    if (!c) return id
    const parent = c.parentId && s.categories.find((x) => x.id === c.parentId)
    return parent ? `${parent.name} > ${c.name}` : c.name
  }
  const labels = new Map<string, string>()
  const anon = (label: string) => {
    if (!o.anonymize) return label
    if (!labels.has(label)) labels.set(label, `Marchand ${labels.size + 1}`)
    return labels.get(label)!
  }

  const L: string[] = []
  L.push(`# Analyse de mon budget personnel`)
  L.push('')
  L.push(`Tu es un·e conseiller·ère en finances personnelles bienveillant·e, pragmatique et très attentif·ve aux détails. Je vis en France (montants en ${s.settings.currency}). Voici les données exportées de mon application de budget, du ${from} au ${today()}. Le « mois budgétaire » commence le ${s.settings.monthStartDay} de chaque mois${cur ? ` (le mois en cours, ${periodLabel(cur)}, n'est pas terminé)` : ''}.`)
  L.push('')
  L.push(`## Ce que j'attends de toi`)
  const asks: string[] = []
  if (o.focus.suspicious) asks.push("Relève tout ce qui est **louche ou anormal** : doublons, prélèvements inconnus, montants inhabituels, hausses de prix, frais bancaires, dépenses qui dérivent d'un mois à l'autre.")
  if (o.focus.subscriptions) asks.push('Liste mes **abonnements et dépenses récurrentes**, estime leur coût annuel et indique lesquels pourraient être réduits, renégociés ou résiliés.')
  if (o.focus.savings) asks.push("Propose des **recommandations concrètes et chiffrées** pour économiser (classées par impact €/mois et par facilité), en restant réaliste avec une vie de famille.")
  if (o.focus.projects) asks.push("Dis-moi si mes **objectifs d'épargne et projets** (Noël, vacances…) sont atteignables au rythme actuel et combien je devrais mettre de côté par mois.")
  if (o.focus.kids) asks.push('Vérifie les **aides et droits** auxquels je pourrais prétendre (CAF, crédit d’impôt garde d’enfants, CESU, mutuelle…) au vu de mes dépenses.')
  asks.push('Ajuste le montant de mes **enveloppes** si elles sont irréalistes (trop larges ou toujours dépassées).')
  asks.push("Termine par un **plan d'action en 3 à 5 étapes** pour le mois prochain, et pose-moi les questions qui te manquent si besoin.")
  asks.forEach((a, i) => L.push(`${i + 1}. ${a}`))
  if (o.question.trim()) {
    L.push('')
    L.push(`**Ma question en particulier :** ${o.question.trim()}`)
  }
  L.push('')
  L.push('Réponds en français, de façon structurée (titres, listes, tableaux), sans jugement. Ne fais pas de suppositions non signalées : si une donnée manque, dis-le.')

  // Monthly summary
  L.push('')
  L.push(`## Synthèse mensuelle`)
  L.push('| Mois | Revenus | Dépenses (nettes des remboursements) | Solde | Taux d’épargne |')
  L.push('|---|---|---|---|---|')
  for (const h of history(s, o.months, cur))
    L.push(`| ${periodLabel(h.period)}${h.period === cur ? ' (en cours)' : ''} | ${eur(h.income)} | ${eur(h.expense)} | ${eur(h.net)} | ${h.income ? Math.round(h.savingsRate * 100) + '%' : '–'} |`)

  // Per category per month
  const periods = Array.from({ length: o.months }, (_, i) => shiftPeriod(first, i))
  const perCat = new Map<string, number[]>()
  periods.forEach((p, i) => {
    for (const [id, v] of spentByTop(s, p)) {
      if (!perCat.has(id)) perCat.set(id, Array(o.months).fill(0))
      perCat.get(id)![i] = v
    }
  })
  L.push('')
  L.push('## Dépenses par catégorie')
  L.push(`| Catégorie | ${periods.map((p) => periodLabel(p, true)).join(' | ')} |`)
  L.push(`|---|${periods.map(() => '---').join('|')}|`)
  for (const [id, vals] of [...perCat.entries()].sort((a, b) => b[1].reduce((x, y) => x + y) - a[1].reduce((x, y) => x + y)))
    L.push(`| ${catName(id)} | ${vals.map(eur).join(' | ')} |`)

  // Envelopes
  if (s.envelopes.length) {
    L.push('')
    L.push(`## Enveloppes budgétaires (${periodLabel(cur)})`)
    L.push('| Enveloppe | Budget | Report | Dépensé | Reste | Mois précédent (dépensé / budget) |')
    L.push('|---|---|---|---|---|---|')
    for (const e of s.envelopes) {
      const st = envelopeStatus(s, e, cur)
      const prev = envelopeStatus(s, e, shiftPeriod(cur, -1))
      L.push(`| ${catName(e.categoryId)} | ${eur(st.budget)} | ${e.rollover ? eur(st.carry) : 'non'} | ${eur(st.spent)} | ${eur(st.left)} | ${eur(prev.spent)} / ${eur(prev.budget)} |`)
    }
  }

  // Recurring
  if (s.recurrings.length) {
    L.push('')
    L.push('## Opérations récurrentes connues')
    for (const r of s.recurrings)
      L.push(`- ${r.type === 'income' ? '➕' : '➖'} ${anon(r.label)} (${catName(r.categoryId)}) : ${eur(r.amount)} — ${FREQ_LABEL[r.frequency].toLowerCase()} (~${eur(monthlyEquivalent(r))}/mois)${r.paused ? ' [en pause]' : ''}`)
  }

  // Goals & events
  if (s.goals.length || s.events.length) {
    L.push('')
    L.push('## Objectifs et projets')
    for (const g of s.goals.filter((x) => !x.archived)) {
      const saved = goalSaved(g)
      L.push(`- Objectif « ${g.name} » : ${eur(saved)} / ${eur(g.target)}${g.deadline ? `, échéance ${g.deadline}` : ''}${g.doneAt ? ' (atteint)' : ''}`)
    }
    for (const e of s.events.filter((x) => !x.archived)) {
      if (e.kind === 'christmas') {
        const planned = e.gifts.reduce((a, g) => a + g.price, 0)
        const bought = e.gifts.filter((g) => g.status === 'toWrap' || g.status === 'ready').reduce((a, g) => a + g.price, 0)
        L.push(`- ${e.name} : budget ${eur(e.budget)}, ${e.gifts.length} cadeaux prévus pour ${eur(planned)} dont ${eur(bought)} déjà achetés${e.people.length ? ` (${e.people.length} personnes)` : ''}`)
      } else {
        const planned = e.items.reduce((a, i) => a + i.planned, 0)
        const paid = e.items.filter((i) => i.paid).reduce((a, i) => a + (i.actual ?? i.planned), 0)
        L.push(`- ${e.name}${e.date ? ` (${e.date})` : ''} : budget ${eur(e.budget)}, prévu ${eur(planned)}, déjà payé ${eur(paid)}`)
      }
    }
  }

  // Health reimbursements
  const waiting = s.transactions.filter((t) => t.reimb && ((t.reimb.secu && !t.reimb.secuAt) || (t.reimb.mutuelle && !t.reimb.mutuelleAt)))
  if (waiting.length) {
    L.push('')
    L.push('## Remboursements santé en attente')
    for (const t of waiting) L.push(`- ${t.date} ${catName(t.categoryId)} ${eur(t.amount)} : Sécu ${t.reimb!.secuAt ? 'reçue' : eur(t.reimb!.secu) + ' attendus'}, mutuelle ${t.reimb!.mutuelleAt ? 'reçue' : eur(t.reimb!.mutuelle) + ' attendus'}`)
  }

  // Local detection
  const ins = computeInsights(s).filter((i) => i.level !== 'good' && i.id !== 'backup')
  if (ins.length) {
    L.push('')
    L.push("## Signaux déjà repérés par l'application (à vérifier/approfondir)")
    for (const i of ins) L.push(`- ${i.title} : ${o.anonymize ? i.text.replace(/« [^»]+ »/g, '« … »') : i.text}`)
  }

  // Details
  if (o.details) {
    const tx = s.transactions.filter((t) => t.date >= from).sort((a, b) => a.date.localeCompare(b.date))
    L.push('')
    L.push(`## Détail des opérations (${tx.length})`)
    L.push('Format CSV : date;type;montant;catégorie;libellé;note')
    L.push('```csv')
    L.push('date;type;montant;categorie;libelle;note')
    for (const t of tx)
      L.push([t.date, t.type === 'income' ? 'revenu' : 'depense', (t.amount / 100).toFixed(2), catName(t.categoryId), anon(t.label).replace(/;/g, ','), (o.anonymize ? '' : t.note ?? '').replace(/[;\n]/g, ' ')].join(';'))
    L.push('```')
  } else {
    // Top labels instead of every line
    const top = new Map<string, { n: number; total: number; cat: string }>()
    for (const t of s.transactions.filter((x) => x.date >= from && x.type === 'expense')) {
      const k = t.label || '(sans libellé)'
      const v = top.get(k) ?? { n: 0, total: 0, cat: topCategory(s, t.categoryId) }
      v.n++
      v.total += t.amount
      top.set(k, v)
    }
    L.push('')
    L.push('## Principaux postes de dépense (par libellé)')
    for (const [k, v] of [...top.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 40))
      L.push(`- ${anon(k)} (${catName(v.cat)}) : ${v.n}× pour ${eur(v.total)}`)
  }
  return L.join('\n')
}
