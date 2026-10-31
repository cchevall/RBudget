import { setPro, state, toast } from '../store/store'
import type { ProActivity } from '../store/types'
import { ACTIVITIES, activityDefaults } from '../store/defaults'
import { microRate } from '../lib/pro'
import { centsToInput, parseMoney } from '../lib/utils'
import { Header, Seg, ToggleRow } from '../components/ui'

const pct = (v: string) => {
  const n = parseFloat(v.replace(',', '.'))
  return isNaN(n) ? 0 : n
}
const pctStr = (n: number) => String(n).replace('.', ',')

export function MoneyField({ label, value, onChange, hint }: { label: string; value: number; onChange: (c: number) => void; hint?: string }) {
  return (
    <label class="field">
      <span>{label}</span>
      <input class="input" inputMode="decimal" value={centsToInput(value)} placeholder="0" onChange={(e) => onChange(parseMoney(e.currentTarget.value))} />
      {hint && <small class="tiny muted" style={{ paddingLeft: 4 }}>{hint}</small>}
    </label>
  )
}

export function PctField({ label, value, onChange, hint }: { label: string; value: number; onChange: (n: number) => void; hint?: string }) {
  return (
    <label class="field">
      <span>{label}</span>
      <input class="input" inputMode="decimal" value={pctStr(value)} onChange={(e) => onChange(pct(e.currentTarget.value))} />
      {hint && <small class="tiny muted" style={{ paddingLeft: 4 }}>{hint}</small>}
    </label>
  )
}

export function ProSettingsPage() {
  const p = state.value.pro.settings
  return (
    <div class="page">
      <Header title="Réglages pro" />

      <div class="card form">
        <h3>🧑‍💻 Activité</h3>
        <label class="field">
          <span>Type d'activité</span>
          <select
            class="input"
            value={p.activity}
            onChange={(e) => {
              setPro(activityDefaults(e.currentTarget.value as ProActivity))
              toast('Taux et plafonds mis à jour', '✨')
            }}
          >
            {(Object.keys(ACTIVITIES) as ProActivity[]).map((a) => (
              <option value={a}>{ACTIVITIES[a].label}</option>
            ))}
          </select>
        </label>
        <div class="field">
          <span>Déclaration URSSAF</span>
          <Seg value={p.declaration} onChange={(v) => setPro({ declaration: v })} options={[['monthly', 'Mensuelle'], ['quarterly', 'Trimestrielle']]} />
        </div>
        <div class="grid2">
          <PctField label="Cotisations (%)" value={p.urssafRate} onChange={(urssafRate) => setPro({ urssafRate })} />
          <PctField label="Formation pro (%)" value={p.cfpRate} onChange={(cfpRate) => setPro({ cfpRate })} />
        </div>
        <ToggleRow label="Versement libératoire" hint="L'impôt sur le revenu est payé avec l'URSSAF" on={p.vl} onChange={(vl) => setPro({ vl })} />
        <div class="grid2">
          {p.vl && <PctField label="Taux libératoire (%)" value={p.vlRate} onChange={(vlRate) => setPro({ vlRate })} />}
          <PctField label="Abattement fiscal (%)" value={p.abattement} onChange={(abattement) => setPro({ abattement })} />
        </div>
        <p class="tiny muted">
          Total prélevé sur le CA : <b>{pctStr(Math.round(microRate(p) * 100) / 100)} %</b>. Les taux bougent souvent : vérifie sur urssaf.fr.
        </p>
      </div>

      <div class="card form">
        <h3>🔀 Régime</h3>
        <label class="field">
          <span>Passage au régime réel le (optionnel)</span>
          <input class="input" type="date" value={p.reelFrom ?? ''} onChange={(e) => setPro({ reelFrom: e.currentTarget.value || undefined })} />
        </label>
        {p.reelFrom && <PctField label="Cotisations estimées au réel (% du bénéfice)" value={p.reelRate} onChange={(reelRate) => setPro({ reelRate })} hint="Environ 40 à 45 % en libéral : affine avec ton comptable" />}
        <div class="grid2">
          <MoneyField label="Plafond micro (€)" value={p.ceiling} onChange={(ceiling) => setPro({ ceiling })} />
          <MoneyField label="Franchise TVA (€)" value={p.tvaThreshold} onChange={(tvaThreshold) => setPro({ tvaThreshold })} />
        </div>
        <ToggleRow label="Clients hors UE uniquement" hint="Prestations B2B hors champ de la TVA française : je masque la jauge TVA" on={p.foreignClients} onChange={(foreignClients) => setPro({ foreignClients })} />
      </div>

      <div class="card form">
        <h3>🧾 Facturation</h3>
        <label class="field">
          <span>Client habituel</span>
          <input class="input" value={p.client} onChange={(e) => setPro({ client: e.currentTarget.value.trim() })} />
        </label>
        <div class="grid2">
          <label class="field">
            <span>Devise</span>
            <select class="input" value={p.currency} onChange={(e) => setPro({ currency: e.currentTarget.value, fxRate: e.currentTarget.value === 'EUR' ? 1 : p.fxRate })}>
              {['EUR', 'USD', 'GBP', 'CHF', 'CAD'].map((c) => (
                <option value={c}>{c}</option>
              ))}
            </select>
          </label>
          <MoneyField label="Montant habituel" value={p.invoiceAmount} onChange={(invoiceAmount) => setPro({ invoiceAmount })} />
        </div>
        {p.currency !== 'EUR' && (
          <label class="field">
            <span>1 {p.currency} = … €</span>
            <input class="input" inputMode="decimal" value={pctStr(p.fxRate)} onChange={(e) => setPro({ fxRate: pct(e.currentTarget.value) || 1 })} />
            <small class="tiny muted" style={{ paddingLeft: 4 }}>
              Mis à jour tout seul à chaque facture encaissée
            </small>
          </label>
        )}
      </div>

      <div class="card form">
        <h3>🏦 Compte pro</h3>
        <label class="field">
          <span>Banque</span>
          <input class="input" value={p.bank} placeholder="Qonto, Shine…" onChange={(e) => setPro({ bank: e.currentTarget.value.trim() })} />
        </label>
        <div class="grid2">
          <MoneyField label="Solde (€)" value={p.openingBalance} onChange={(openingBalance) => setPro({ openingBalance })} />
          <label class="field">
            <span>au matin du</span>
            <input class="input" type="date" value={p.openingDate} onChange={(e) => e.currentTarget.value && setPro({ openingDate: e.currentTarget.value })} />
          </label>
        </div>
        <p class="tiny muted">Je recalcule la trésorerie à partir de ce solde. Si elle s'écarte de ta banque, corrige-le ici avec la date du jour.</p>
        <MoneyField label="Coussin de sécurité (€)" value={p.cushion} onChange={(cushion) => setPro({ cushion })} hint="Toujours laissé sur le compte pro, jamais proposé au versement" />
      </div>

      <div class="card form">
        <h3>🧾 Impôts & taxes</h3>
        <MoneyField label="CFE estimée par an (€)" value={p.cfe} onChange={(cfe) => setPro({ cfe })} hint="Mise de côté jusqu'à ce que tu la payes (mi-décembre). 0 si exonéré·e." />
        {!p.vl && <PctField label="Taux de prélèvement à la source du foyer (%)" value={p.pasRate} onChange={(pasRate) => setPro({ pasRate })} hint="Sur impots.gouv → Gérer mon prélèvement à la source" />}
      </div>
    </div>
  )
}
