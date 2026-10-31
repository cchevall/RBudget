import { state, update } from '../store/store'
import type { ImmoSettings } from '../store/types'
import { immoAt, immoMonthly, monthsUntil, suggestedIncome } from '../lib/immo'
import { money, shortDate } from '../lib/utils'
import { CountUp, Header, Seg, ToggleRow } from '../components/ui'
import { MoneyField, PctField } from './ProSettings'

const setImmo = (patch: Partial<ImmoSettings>) => update((s) => void Object.assign(s.immo, patch), { silent: true })

export function Immo() {
  const s = state.value
  const i = s.immo
  const ae = s.settings.profile === 'ae'
  const m = monthsUntil(i.targetDate)
  const at = immoAt(s, i, m)
  const monthly = immoMonthly(s, i)
  const auto = suggestedIncome(s)
  const years = Array.from({ length: 11 }, (_, k) => immoAt(s, i, k * 12))

  return (
    <div class="page">
      <Header title="Projet immo" />

      <div class="hero">
        <div class="small" style={{ opacity: 0.9 }}>
          Budget max dans l'ancien · {shortDate(at.date)} {at.date.slice(0, 4)}
        </div>
        <div class="big">
          <CountUp value={at.priceOld} />
        </div>
        <div class="small" style={{ opacity: 0.95, marginTop: 2 }}>
          frais de notaire (≈ 8 %) payés en plus · {money(at.priceNew)} dans le neuf
        </div>
        <div class="row mt" style={{ gap: 8 }}>
          <div class="pill">
            <span>Prêt</span>
            <b>{money(at.loan)}</b>
          </div>
          <div class="pill">
            <span>Apport</span>
            <b>{money(at.apport)}</b>
          </div>
          <div class="pill">
            <span>Mensualité</span>
            <b>{money(monthly.available)}</b>
          </div>
        </div>
      </div>

      <div class="card form mt">
        <label class="field">
          <span>Achat prévu en</span>
          <input class="input" type="month" value={i.targetDate.slice(0, 7)} onChange={(e) => e.currentTarget.value && setImmo({ targetDate: e.currentTarget.value + '-01' })} />
        </label>
        {i.sell && at.bridge > 0 && (
          <p class="small">
            🌉 En achetant <b>avant</b> de vendre (prêt relais ≈ {money(at.bridge)}) : jusqu'à <b>{money(at.priceOldBridge)}</b> dans l'ancien.
          </p>
        )}
      </div>

      <div class="card form">
        <h3>🏦 Capacité d'emprunt</h3>
        <MoneyField
          label="Revenus nets mensuels retenus par la banque"
          value={i.income}
          onChange={(income) => setImmo({ income })}
          hint={i.income ? undefined : `Vide = ${money(auto)}, estimé ${ae ? 'sur 12 mois d’activité (CA − URSSAF − frais)' : 'sur tes 3 derniers mois'}${ae ? '. Les banques regardent souvent la moyenne de 2 à 3 bilans.' : ''}`}
        />
        <div class="grid2">
          <MoneyField label="Revenus co-emprunteur" value={i.coIncome} onChange={(coIncome) => setImmo({ coIncome })} />
          <MoneyField label="Crédits qui restent" value={i.credits} onChange={(credits) => setImmo({ credits })} hint="Sans le crédit du bien vendu" />
        </div>
        <div class="grid2">
          <PctField label="Endettement max (%)" value={i.maxDebt} onChange={(maxDebt) => setImmo({ maxDebt })} />
          <PctField label="Taux (TAEG %)" value={i.rate} onChange={(rate) => setImmo({ rate })} />
        </div>
        <Seg value={String(i.years)} onChange={(v) => setImmo({ years: Number(v) })} options={[['15', '15 ans'], ['20', '20 ans'], ['25', '25 ans']]} />
        <p class="small muted">
          {money(monthly.income)} × {i.maxDebt} % = {money(monthly.max)}/mois{i.credits ? `, moins ${money(i.credits)} de crédits` : ''} → <b>{money(monthly.available)}/mois</b> sur {i.years} ans = <b>{money(at.loan)}</b>
        </p>
      </div>

      <div class="card form">
        <h3>🐷 Apport</h3>
        <div class="grid2">
          <MoneyField label="Épargne aujourd'hui" value={i.savings} onChange={(savings) => setImmo({ savings })} />
          <MoneyField label="Épargne par mois" value={i.monthlySavings} onChange={(monthlySavings) => setImmo({ monthlySavings })} />
        </div>
        <MoneyField label="Apport du co-emprunteur" value={i.coSavings} onChange={(coSavings) => setImmo({ coSavings })} />
      </div>

      <div class="card form">
        <ToggleRow label="🏠 Je revends mon logement" hint="La vente (moins le capital restant dû) vient grossir l'apport" on={i.sell} onChange={(sell) => setImmo({ sell })} />
        {i.sell && (
          <>
            <MoneyField label="Estimation de vente" value={i.saleValue} onChange={(saleValue) => setImmo({ saleValue })} />
            <div class="grid2">
              <MoneyField label="Capital restant dû" value={i.crd} onChange={(crd) => setImmo({ crd })} />
              <MoneyField label="Capital remboursé / mois" value={i.crdMonthly} onChange={(crdMonthly) => setImmo({ crdMonthly })} />
            </div>
          </>
        )}
      </div>

      <div class="section">
        <div class="section-title">
          <h2>🔮 Projection</h2>
        </div>
        <div class="card">
          <div class="row tiny muted bold" style={{ padding: '0 0 6px' }}>
            <span class="grow">Date</span>
            <span style={{ width: 82, textAlign: 'right' }}>Apport</span>
            <span style={{ width: 92, textAlign: 'right' }}>Ancien</span>
            <span style={{ width: 92, textAlign: 'right' }}>Neuf</span>
          </div>
          {years.map((y) => (
            <div class="row small" style={{ padding: '6px 0', borderTop: '1px solid var(--line)', fontWeight: Math.abs(y.months - m) < 6 ? 700 : undefined }}>
              <span class="grow">{y.months ? y.date.slice(0, 4) : "Aujourd'hui"}</span>
              <span class="num" style={{ width: 82, textAlign: 'right' }}>
                {money(Math.round(y.apport / 1000) * 1000)}
              </span>
              <span class="num" style={{ width: 92, textAlign: 'right' }}>
                {money(Math.round(y.priceOld / 1000) * 1000)}
              </span>
              <span class="num" style={{ width: 92, textAlign: 'right' }}>
                {money(Math.round(y.priceNew / 1000) * 1000)}
              </span>
            </div>
          ))}
        </div>
        <p class="tiny faint mt center">Simulation indicative à taux et revenus constants : à confronter avec ta banque ou un courtier.</p>
      </div>
    </div>
  )
}
