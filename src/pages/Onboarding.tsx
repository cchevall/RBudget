import { useState } from 'preact/hooks'
import { replaceState, runRecurrings, update, fireConfetti } from '../store/store'
import { demoState } from '../lib/demo'
import { addMonths, parseMoney, pad, today, uid } from '../lib/utils'
import { Mascot } from '../components/Mascot'
import { Bubble } from '../components/ui'
import { cat } from '../store/store'
import type { Recurring } from '../store/types'

/** Next date (today or later) falling on that day of month */
const nextDay = (day: number) => {
  const t = today()
  const candidate = `${t.slice(0, 8)}${pad(Math.min(day, 28))}`
  return candidate >= t ? candidate : addMonths(candidate, 1, day)
}

const FIXED: { id: string; label: string; cat: string; day: number }[] = [
  { id: 'loyer', label: 'Loyer / crédit maison', cat: 'logement', day: 5 },
  { id: 'voiture', label: 'Crédit voiture', cat: 'credit-voiture', day: 10 },
  { id: 'matmut', label: 'Matmut', cat: 'matmut', day: 8 },
  { id: 'lunettes', label: 'Assurance lunettes', cat: 'assu-lunettes', day: 15 },
  { id: 'netflix', label: 'Netflix', cat: 'netflix', day: 20 },
  { id: 'tel', label: 'Téléphone & box', cat: 'telephone', day: 12 },
  { id: 'creche', label: 'Crèche', cat: 'enf-creche', day: 5 },
  { id: 'energie', label: 'Électricité / gaz', cat: 'logement', day: 15 },
]

export function Onboarding() {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [salary, setSalary] = useState({ amount: '', day: '28' })
  const [caf, setCaf] = useState({ amount: '', day: '5' })
  const [startOnPay, setStartOnPay] = useState(false)
  const [fixed, setFixed] = useState<Record<string, { on: boolean; amount: string; day: string }>>({})

  const finish = () => {
    const recs: Recurring[] = []
    const add = (label: string, categoryId: string, amount: number, day: number, type: 'income' | 'expense', autoPost = true) =>
      amount > 0 && recs.push({ id: uid(), label, categoryId, amount, type, frequency: 'monthly', startDate: nextDay(day), autoPost })
    add('Salaire', 'salaire', parseMoney(salary.amount), Number(salary.day) || 1, 'income')
    add('CAF', 'caf', parseMoney(caf.amount), Number(caf.day) || 5, 'income', false)
    for (const f of FIXED) {
      const v = fixed[f.id]
      if (v?.on) add(f.label, f.cat, parseMoney(v.amount), Number(v.day) || f.day, 'expense')
    }
    update((s) => {
      s.settings.name = name.trim()
      s.settings.onboarded = true
      if (startOnPay && Number(salary.day) > 1) s.settings.monthStartDay = Math.min(28, Number(salary.day))
      s.recurrings.push(...recs)
    })
    runRecurrings()
    fireConfetti()
  }

  const Dots = () => (
    <div class="row" style={{ justifyContent: 'center', gap: 6 }}>
      {[0, 1, 2, 3].map((i) => (
        <span style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 9, background: i <= step ? 'var(--accent)' : 'var(--line)', transition: 'all .4s var(--spring)' }} />
      ))}
    </div>
  )

  return (
    <div class="page" style={{ paddingBottom: 40 }} key={step}>
      <Dots />
      {step === 0 && (
        <div class="fullscreen" style={{ minHeight: '80vh' }}>
          <Mascot mood="party" size={170} />
          <h1>Coucou, moi c'est Mochi !</h1>
          <p class="muted">Je suis ta petite tirelire. Je m'occupe du travail ennuyeux (récurrences, catégories, calculs) pour que ton budget reste <b>facile</b> et <b>fun</b>. Promis, 30 secondes par jour suffisent ⏱️</p>
          <div class="col" style={{ width: '100%', maxWidth: 340 }}>
            <button class="btn block" onClick={() => setStep(1)}>
              C'est parti ! 🚀
            </button>
            <button class="btn ghost block" onClick={() => replaceState(demoState())}>
              Explorer avec des données d'exemple
            </button>
          </div>
          <p class="tiny faint">🔒 Tout reste sur ton téléphone, rien n'est envoyé nulle part.</p>
        </div>
      )}

      {step === 1 && (
        <div class="col gap-l mt-l">
          <div class="row">
            <Mascot mood="love" size={80} />
            <div class="speech grow">Comment je t'appelle ?</div>
          </div>
          <input class="input" style={{ fontSize: 20 }} placeholder="Ton prénom" value={name} onInput={(e) => setName(e.currentTarget.value)} autoFocus />
          <button class="btn block" onClick={() => setStep(2)}>
            Suivant →
          </button>
        </div>
      )}

      {step === 2 && (
        <div class="col gap-l mt-l">
          <div class="row">
            <Mascot mood="happy" size={80} />
            <div class="speech grow">Tes revenus réguliers ? Je les ajouterai tout seul chaque mois 💰</div>
          </div>
          <div class="card form">
            <h3>💼 Salaire (net)</h3>
            <div class="grid2">
              <label class="field">
                <span>Montant</span>
                <input class="input" inputMode="decimal" placeholder="2000" value={salary.amount} onInput={(e) => setSalary({ ...salary, amount: e.currentTarget.value })} />
              </label>
              <label class="field">
                <span>Versé le</span>
                <input class="input" inputMode="numeric" value={salary.day} onInput={(e) => setSalary({ ...salary, day: e.currentTarget.value })} />
              </label>
            </div>
            {Number(salary.day) > 20 && (
              <label class="toggle-row">
                <div>
                  <div class="bold small">Commencer mon mois le {salary.day}</div>
                  <div class="tiny muted">Pratique quand la paie tombe en fin de mois</div>
                </div>
                <button class={`switch ${startOnPay ? 'on' : ''}`} onClick={() => setStartOnPay(!startOnPay)} />
              </label>
            )}
          </div>
          <div class="card form">
            <h3>👶 CAF</h3>
            <div class="grid2">
              <label class="field">
                <span>Montant</span>
                <input class="input" inputMode="decimal" placeholder="0" value={caf.amount} onInput={(e) => setCaf({ ...caf, amount: e.currentTarget.value })} />
              </label>
              <label class="field">
                <span>Versée le</span>
                <input class="input" inputMode="numeric" value={caf.day} onInput={(e) => setCaf({ ...caf, day: e.currentTarget.value })} />
              </label>
            </div>
            <p class="tiny muted">Je te demanderai de confirmer le montant chaque mois, vu qu'il peut changer.</p>
          </div>
          <button class="btn block" onClick={() => setStep(3)}>
            Suivant →
          </button>
        </div>
      )}

      {step === 3 && (
        <div class="col gap-l mt-l">
          <div class="row">
            <Mascot mood="happy" size={80} />
            <div class="speech grow">Et tes prélèvements fixes ? Coche, mets le montant, j'm'occupe du reste 🤖</div>
          </div>
          <div class="card">
            {FIXED.map((f) => {
              const v = fixed[f.id] ?? { on: false, amount: '', day: String(f.day) }
              const c = cat(f.cat)
              const setV = (patch: Partial<typeof v>) => setFixed({ ...fixed, [f.id]: { ...v, ...patch } })
              return (
                <div class="item" style={{ flexWrap: 'wrap' }}>
                  <button class={`check ${v.on ? 'on' : ''}`} onClick={() => setV({ on: !v.on })}>
                    {v.on ? '✓' : ''}
                  </button>
                  <Bubble emoji={c.emoji} color={c.color} size="sm" />
                  <span class="grow small bold" onClick={() => setV({ on: !v.on })}>
                    {f.label}
                  </span>
                  {v.on && (
                    <div class="row" style={{ width: '100%', paddingLeft: 38, gap: 8, animation: 'pop-in .3s var(--spring)' }}>
                      <input class="input" inputMode="decimal" placeholder="Montant" style={{ minHeight: 38 }} value={v.amount} onInput={(e) => setV({ amount: e.currentTarget.value })} />
                      <input class="input" inputMode="numeric" style={{ minHeight: 38, width: 90 }} value={v.day} onInput={(e) => setV({ day: e.currentTarget.value })} aria-label="Jour" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p class="tiny muted center">Tu pourras en ajouter d'autres dans « Récurrentes ».</p>
          <button class="btn block" onClick={finish}>
            Terminer ✨
          </button>
        </div>
      )}
    </div>
  )
}
