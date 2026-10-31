import { useState } from 'preact/hooks'
import { replaceState, runRecurrings, update, fireConfetti } from '../store/store'
import { ACTIVITIES, activityDefaults } from '../store/defaults'
import { demoState } from '../lib/demo'
import { PRO_KINDS, REMU } from '../lib/pro'
import { addMonths, parseMoney, pad, today, uid } from '../lib/utils'
import { Mascot } from '../components/Mascot'
import { Bubble, Seg, ToggleRow } from '../components/ui'
import { cat } from '../store/store'
import type { Frequency, ProActivity, ProKind, Profile, Recurring } from '../store/types'

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

const PRO_FIXED: { id: string; label: string; kind: ProKind; day: number }[] = [
  { id: 'banque', label: 'Banque pro', kind: 'banque', day: 1 },
  { id: 'mutuelle', label: 'Mutuelle / prévoyance', kind: 'assurance', day: 5 },
  { id: 'rcpro', label: 'RC Pro', kind: 'assurance', day: 10 },
  { id: 'logiciels', label: 'Logiciels & abonnements', kind: 'logiciels', day: 15 },
  { id: 'comptable', label: 'Expert-comptable', kind: 'comptable', day: 20 },
]

type Step = 'hello' | 'name' | 'profile' | 'income' | 'activity' | 'pay' | 'fixed'
type FixedValue = { on: boolean; amount: string; day: string }

/** Checklist of fixed charges with amount and day of month */
function FixedList<T extends { id: string; label: string; day: number }>({ items, values, setValues, look }: { items: T[]; values: Record<string, FixedValue>; setValues: (v: Record<string, FixedValue>) => void; look: (item: T) => { emoji: string; color: string } }) {
  return (
    <div class="card">
      {items.map((f) => {
        const v = values[f.id] ?? { on: false, amount: '', day: String(f.day) }
        const l = look(f)
        const setV = (patch: Partial<FixedValue>) => setValues({ ...values, [f.id]: { ...v, ...patch } })
        return (
          <div class="item" style={{ flexWrap: 'wrap' }}>
            <button class={`check ${v.on ? 'on' : ''}`} onClick={() => setV({ on: !v.on })}>
              {v.on ? '✓' : ''}
            </button>
            <Bubble emoji={l.emoji} color={l.color} size="sm" />
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
  )
}

export function Onboarding() {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [profile, setProfile] = useState<Profile>('salarie')
  const [salary, setSalary] = useState({ amount: '', day: '28' })
  const [caf, setCaf] = useState({ amount: '', day: '5' })
  const [startOnPay, setStartOnPay] = useState(false)
  const [fixed, setFixed] = useState<Record<string, FixedValue>>({})
  const [act, setAct] = useState({ activity: 'bnc' as ProActivity, declaration: 'monthly' as 'monthly' | 'quarterly', vl: false, client: '', currency: 'EUR', amount: '', fx: '', bank: '', balance: '', reelFrom: '' })
  const [pay, setPay] = useState({ amount: '', frequency: 'monthly' as Frequency, date: nextDay(1) })
  const [proFixed, setProFixed] = useState<Record<string, FixedValue>>({})
  const steps: Step[] = ['hello', 'name', 'profile', ...(profile === 'ae' ? (['activity', 'pay'] as Step[]) : (['income'] as Step[])), 'fixed']
  const cur = steps[step]
  const next = () => setStep(step + 1)

  const finish = () => {
    const recs: Recurring[] = []
    const add = (label: string, categoryId: string, amount: number, day: number, type: 'income' | 'expense', autoPost = true) =>
      amount > 0 && recs.push({ id: uid(), label, categoryId, amount, type, frequency: 'monthly', startDate: nextDay(day), autoPost })
    if (profile === 'salarie') add('Salaire', 'salaire', parseMoney(salary.amount), Number(salary.day) || 1, 'income')
    else if (parseMoney(pay.amount) > 0) recs.push({ id: uid(), label: 'Virement pro', categoryId: REMU, amount: parseMoney(pay.amount), type: 'income', frequency: pay.frequency, startDate: pay.date, autoPost: true })
    add('CAF', 'caf', parseMoney(caf.amount), Number(caf.day) || 5, 'income', false)
    for (const f of FIXED) {
      const v = fixed[f.id]
      if (v?.on) add(f.label, f.cat, parseMoney(v.amount), Number(v.day) || f.day, 'expense')
    }
    const proRecs: Recurring[] = PRO_FIXED.filter((f) => proFixed[f.id]?.on && parseMoney(proFixed[f.id].amount) > 0).map((f) => ({
      id: uid(),
      label: f.label,
      categoryId: f.kind,
      amount: parseMoney(proFixed[f.id].amount),
      type: 'expense',
      frequency: 'monthly',
      startDate: nextDay(Number(proFixed[f.id].day) || f.day),
      autoPost: true,
    }))
    update((s) => {
      s.settings.name = name.trim()
      s.settings.onboarded = true
      s.settings.profile = profile
      if (profile === 'salarie' && startOnPay && Number(salary.day) > 1) s.settings.monthStartDay = Math.min(28, Number(salary.day))
      s.recurrings.push(...recs)
      if (profile === 'ae') {
        const fx = parseFloat(act.fx.replace(',', '.'))
        Object.assign(s.pro.settings, activityDefaults(act.activity), {
          declaration: act.declaration,
          vl: act.vl,
          client: act.client.trim(),
          currency: act.currency,
          fxRate: act.currency === 'EUR' ? 1 : fx > 0 ? fx : 1,
          invoiceAmount: parseMoney(act.amount),
          bank: act.bank.trim(),
          openingBalance: parseMoney(act.balance),
          openingDate: today(),
          reelFrom: act.reelFrom || undefined,
          foreignClients: act.currency !== 'EUR',
        })
        s.pro.recurrings.push(...proRecs)
      }
    })
    runRecurrings()
    fireConfetti()
  }

  const Dots = () => (
    <div class="row" style={{ justifyContent: 'center', gap: 6 }}>
      {steps.map((_, i) => (
        <span style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 9, background: i <= step ? 'var(--accent)' : 'var(--line)', transition: 'all .4s var(--spring)' }} />
      ))}
    </div>
  )

  const cafCard = (
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
  )

  return (
    <div class="page" style={{ paddingBottom: 40 }} key={step}>
      <Dots />
      {cur === 'hello' && (
        <div class="fullscreen" style={{ minHeight: '80vh' }}>
          <Mascot mood="party" size={170} />
          <h1>Coucou, moi c'est Mochi !</h1>
          <p class="muted">Je suis ta petite tirelire. Je m'occupe du travail ennuyeux (récurrences, catégories, calculs) pour que ton budget reste <b>facile</b> et <b>fun</b>. Promis, 30 secondes par jour suffisent ⏱️</p>
          <div class="col" style={{ width: '100%', maxWidth: 340 }}>
            <button class="btn block" onClick={next}>
              C'est parti ! 🚀
            </button>
            <button class="btn ghost block" onClick={() => replaceState(demoState())}>
              Explorer avec des données d'exemple
            </button>
          </div>
          <p class="tiny faint">🔒 Tout reste sur ton téléphone, rien n'est envoyé nulle part.</p>
        </div>
      )}

      {cur === 'name' && (
        <div class="col gap-l mt-l">
          <div class="row">
            <Mascot mood="love" size={80} />
            <div class="speech grow">Comment je t'appelle ?</div>
          </div>
          <input class="input" style={{ fontSize: 20 }} placeholder="Ton prénom" value={name} onInput={(e) => setName(e.currentTarget.value)} autoFocus />
          <button class="btn block" onClick={next}>
            Suivant →
          </button>
        </div>
      )}

      {cur === 'profile' && (
        <div class="col gap-l mt-l">
          <div class="row">
            <Mascot mood="happy" size={80} />
            <div class="speech grow">Tu es plutôt salarié·e ou auto-entrepreneur·e ?</div>
          </div>
          {(
            [
              ['salarie', '💼', 'Salarié·e', 'Un salaire qui tombe chaque mois : je gère ton budget perso.'],
              ['ae', '🧑‍💻', 'Auto-entrepreneur·e', 'Je gère aussi ton activité : factures, URSSAF, frais pro, impôts, CFE… et combien tu peux te verser.'],
            ] as [Profile, string, string, string][]
          ).map(([id, e, title, text]) => (
            <button class={`card tap ${profile === id ? 'soft' : ''}`} style={{ textAlign: 'left', border: profile === id ? '2px solid var(--accent)' : undefined }} onClick={() => setProfile(id)}>
              <div class="row">
                <span style={{ fontSize: 34 }}>{e}</span>
                <div class="grow">
                  <b>{title}</b>
                  <div class="small muted">{text}</div>
                </div>
              </div>
            </button>
          ))}
          <p class="tiny muted center">Tu pourras changer ça dans les réglages.</p>
          <button class="btn block" onClick={next}>
            Suivant →
          </button>
        </div>
      )}

      {cur === 'income' && (
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
          {cafCard}
          <button class="btn block" onClick={next}>
            Suivant →
          </button>
        </div>
      )}

      {cur === 'activity' && (
        <div class="col gap-l mt-l">
          <div class="row">
            <Mascot mood="love" size={80} />
            <div class="speech grow">Parle-moi de ton activité, je m'occupe des calculs URSSAF 🧮</div>
          </div>
          <div class="card form">
            <label class="field">
              <span>Type d'activité</span>
              <select class="input" value={act.activity} onChange={(e) => setAct({ ...act, activity: e.currentTarget.value as ProActivity })}>
                {(Object.keys(ACTIVITIES) as ProActivity[]).map((a) => (
                  <option value={a}>{ACTIVITIES[a].label}</option>
                ))}
              </select>
            </label>
            <div class="field">
              <span>Je déclare mon CA à l'URSSAF</span>
              <Seg value={act.declaration} onChange={(declaration) => setAct({ ...act, declaration })} options={[['monthly', 'Chaque mois'], ['quarterly', 'Chaque trimestre']]} />
            </div>
            <ToggleRow label="Versement libératoire" hint="Ton impôt sur le revenu est payé avec l'URSSAF" on={act.vl} onChange={(vl) => setAct({ ...act, vl })} />
            <label class="field">
              <span>Passage au régime réel prévu le (optionnel)</span>
              <input class="input" type="date" value={act.reelFrom} onInput={(e) => setAct({ ...act, reelFrom: e.currentTarget.value })} />
            </label>
          </div>
          <div class="card form">
            <h3>🧾 Facturation</h3>
            <label class="field">
              <span>Client principal</span>
              <input class="input" placeholder="Nom du client" value={act.client} onInput={(e) => setAct({ ...act, client: e.currentTarget.value })} />
            </label>
            <div class="grid2">
              <label class="field">
                <span>Facture habituelle</span>
                <input class="input" inputMode="decimal" placeholder="5000" value={act.amount} onInput={(e) => setAct({ ...act, amount: e.currentTarget.value })} />
              </label>
              <label class="field">
                <span>Devise</span>
                <select class="input" value={act.currency} onChange={(e) => setAct({ ...act, currency: e.currentTarget.value })}>
                  {['EUR', 'USD', 'GBP', 'CHF', 'CAD'].map((c) => (
                    <option value={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            {act.currency !== 'EUR' && (
              <label class="field">
                <span>1 {act.currency} ≈ … €</span>
                <input class="input" inputMode="decimal" placeholder="0,90" value={act.fx} onInput={(e) => setAct({ ...act, fx: e.currentTarget.value })} />
              </label>
            )}
          </div>
          <div class="card form">
            <h3>🏦 Compte pro</h3>
            <div class="grid2">
              <label class="field">
                <span>Banque</span>
                <input class="input" placeholder="Qonto…" value={act.bank} onInput={(e) => setAct({ ...act, bank: e.currentTarget.value })} />
              </label>
              <label class="field">
                <span>Solde actuel</span>
                <input class="input" inputMode="decimal" placeholder="0" value={act.balance} onInput={(e) => setAct({ ...act, balance: e.currentTarget.value })} />
              </label>
            </div>
          </div>
          <button class="btn block" onClick={next}>
            Suivant →
          </button>
        </div>
      )}

      {cur === 'pay' && (
        <div class="col gap-l mt-l">
          <div class="row">
            <Mascot mood="happy" size={80} />
            <div class="speech grow">Combien tu te verses du compte pro vers ton compte perso ? C'est ton « salaire » 💰</div>
          </div>
          <div class="card form">
            <h3>🧑‍💻 Virement vers le perso</h3>
            <div class="grid2">
              <label class="field">
                <span>Montant</span>
                <input class="input" inputMode="decimal" placeholder="3000" value={pay.amount} onInput={(e) => setPay({ ...pay, amount: e.currentTarget.value })} />
              </label>
              <label class="field">
                <span>Prochain virement</span>
                <input class="input" type="date" value={pay.date} onInput={(e) => e.currentTarget.value && setPay({ ...pay, date: e.currentTarget.value })} />
              </label>
            </div>
            <Seg value={pay.frequency} onChange={(frequency) => setPay({ ...pay, frequency })} options={[['monthly', 'Chaque mois'], ['biweekly', 'Toutes les 2 semaines']]} />
            <p class="tiny muted">Je l'ajoute tout seul en revenu perso et je le retire de ta trésorerie pro. Pas d'idée ? Laisse vide : l'écran Pro te dira combien tu peux te verser.</p>
          </div>
          {cafCard}
          <button class="btn block" onClick={next}>
            Suivant →
          </button>
        </div>
      )}

      {cur === 'fixed' && (
        <div class="col gap-l mt-l">
          <div class="row">
            <Mascot mood="happy" size={80} />
            <div class="speech grow">Et tes prélèvements fixes ? Coche, mets le montant, j'm'occupe du reste 🤖</div>
          </div>
          <FixedList items={FIXED} values={fixed} setValues={setFixed} look={(f) => cat(f.cat)} />
          {profile === 'ae' && (
            <>
              <div class="row">
                <Mascot mood="love" size={60} />
                <div class="speech grow">Et côté compte pro ? 💼</div>
              </div>
              <FixedList items={PRO_FIXED} values={proFixed} setValues={setProFixed} look={(f) => PRO_KINDS[f.kind]} />
            </>
          )}
          <p class="tiny muted center">Tu pourras en ajouter d'autres dans « Récurrentes »{profile === 'ae' ? ' et « Dépenses pro »' : ''}.</p>
          <button class="btn block" onClick={finish}>
            Terminer ✨
          </button>
        </div>
      )}
    </div>
  )
}
