import { useState } from 'preact/hooks'
import { cat, deleteRecurring, saveRecurring, state, toast } from '../store/store'
import type { Frequency, Recurring, TxType } from '../store/types'
import { FREQ_LABEL, monthlyEquivalent, nextOccurrence } from '../lib/recurring'
import { detectSubscriptions } from '../lib/insights'
import { addDays, addMonths, centsToInput, money, parseMoney, shortDate, today } from '../lib/utils'
import { Bubble, ConfirmButton, Empty, Header, Seg, Sheet, ToggleRow } from '../components/ui'
import { CategorySelect } from '../components/common'

export function RecurringPage() {
  const s = state.value
  const [edit, setEdit] = useState<Partial<Recurring> | null>(null)
  const incomes = s.recurrings.filter((r) => r.type === 'income')
  const expenses = s.recurrings.filter((r) => r.type === 'expense')
  const mIn = incomes.filter((r) => !r.paused).reduce((a, r) => a + monthlyEquivalent(r), 0)
  const mOut = expenses.filter((r) => !r.paused).reduce((a, r) => a + monthlyEquivalent(r), 0)
  const subs = detectSubscriptions(s)

  const Row = ({ r }: { r: Recurring }) => {
    const next = nextOccurrence(r, addDays(today(), -1))
    return (
      <button class="item" onClick={() => setEdit(r)} style={{ opacity: r.paused ? 0.5 : 1 }}>
        <Bubble emoji={cat(r.categoryId).emoji} color={cat(r.categoryId).color} size="sm" />
        <div class="grow">
          <div class="bold small">{r.label}</div>
          <div class="tiny muted">
            {FREQ_LABEL[r.frequency]}
            {next && !r.paused ? ` · prochain ${shortDate(next)}` : ''}
            {r.paused ? ' · en pause' : ''}
            {!r.autoPost && ' · à confirmer'}
          </div>
        </div>
        <b class={`num small ${r.type === 'income' ? 'good' : ''}`}>{money(r.amount)}</b>
      </button>
    )
  }

  return (
    <div class="page">
      <Header title="Récurrentes" right={<button class="icon-btn" onClick={() => setEdit({ type: 'expense' })}>＋</button>} />
      <p class="small muted" style={{ margin: '0 4px 12px' }}>
        Salaire, CAF, crédit, assurances, abonnements… saisis-les une fois, l'app les ajoute toute seule chaque mois 🤖
      </p>
      <div class="grid2">
        <div class="card" style={{ padding: 14 }}>
          <div class="tiny muted">Revenus fixes / mois</div>
          <b class="num good">{money(Math.round(mIn))}</b>
        </div>
        <div class="card" style={{ padding: 14 }}>
          <div class="tiny muted">Charges fixes / mois</div>
          <b class="num">{money(Math.round(mOut))}</b>
        </div>
      </div>

      {subs.length > 0 && (
        <div class="card mt" style={{ background: 'var(--info-soft)', borderColor: 'transparent' }}>
          <b>🔍 Détectés dans tes dépenses</b>
          {subs.map((x) => (
            <div class="item">
              <Bubble emoji={cat(x.categoryId).emoji} color={cat(x.categoryId).color} size="sm" />
              <div class="grow">
                <div class="bold small">{x.label}</div>
                <div class="tiny muted">
                  {x.months} mois · ~{money(x.amount)}
                </div>
              </div>
              <button
                class="btn sm"
                onClick={() => {
                  saveRecurring({ label: x.label, amount: x.amount, categoryId: x.categoryId, type: 'expense', frequency: 'monthly', startDate: addMonths(x.last.date, 1), autoPost: true })
                  toast('Récurrente ajoutée', '🤖')
                }}
              >
                ＋
              </button>
            </div>
          ))}
        </div>
      )}

      <div class="section">
        <div class="section-title">
          <h2>💰 Revenus</h2>
          <button onClick={() => setEdit({ type: 'income' })}>＋ Ajouter</button>
        </div>
        <div class="card">{incomes.length ? incomes.map((r) => <Row r={r} key={r.id} />) : <Empty emoji="💼" title="Salaire, CAF…" text="Ajoute tes revenus réguliers." />}</div>
      </div>
      <div class="section">
        <div class="section-title">
          <h2>🧾 Charges</h2>
          <button onClick={() => setEdit({ type: 'expense' })}>＋ Ajouter</button>
        </div>
        <div class="card">{expenses.length ? expenses.map((r) => <Row r={r} key={r.id} />) : <Empty emoji="🏠" title="Loyer, crédit, assurances…" text="Ajoute tes prélèvements réguliers." />}</div>
      </div>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Modifier' : 'Nouvelle récurrente'}>
        {edit && <RecurringForm key={edit.id ?? 'new'} initial={edit} onDone={() => setEdit(null)} />}
      </Sheet>
    </div>
  )
}

export function RecurringForm({ initial, onDone }: { initial: Partial<Recurring>; onDone: () => void }) {
  const [type, setType] = useState<TxType>(initial.type ?? 'expense')
  const [label, setLabel] = useState(initial.label ?? '')
  const [amount, setAmount] = useState(centsToInput(initial.amount ?? 0))
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? '')
  const [frequency, setFrequency] = useState<Frequency>(initial.frequency ?? 'monthly')
  const [startDate, setStartDate] = useState(initial.startDate ?? today())
  const [autoPost, setAutoPost] = useState(initial.autoPost ?? true)
  const [paused, setPaused] = useState(initial.paused ?? false)
  return (
    <div class="form">
      <Seg value={type} onChange={(t) => (setType(t), setCategoryId(''))} options={[['expense', '🧾 Charge'], ['income', '💰 Revenu']]} />
      <label class="field">
        <span>Libellé</span>
        <input class="input" placeholder={type === 'income' ? 'Salaire, CAF…' : 'Crédit voiture, Matmut, Netflix…'} value={label} onInput={(e) => setLabel(e.currentTarget.value)} />
      </label>
      <div class="grid2">
        <label class="field">
          <span>Montant</span>
          <input class="input" inputMode="decimal" value={amount} onInput={(e) => setAmount(e.currentTarget.value)} />
        </label>
        <label class="field">
          <span>{initial.id ? 'Première échéance' : 'Prochaine échéance'}</span>
          <input class="input" type="date" value={startDate} onInput={(e) => setStartDate(e.currentTarget.value)} />
        </label>
      </div>
      <label class="field">
        <span>Catégorie</span>
        <CategorySelect value={categoryId} onChange={setCategoryId} kind={type} />
      </label>
      <label class="field">
        <span>Fréquence</span>
        <select class="input" value={frequency} onChange={(e) => setFrequency(e.currentTarget.value as Frequency)}>
          {(Object.keys(FREQ_LABEL) as Frequency[]).map((f) => (
            <option value={f}>{FREQ_LABEL[f]}</option>
          ))}
        </select>
      </label>
      <ToggleRow label="Ajouter automatiquement" hint={autoPost ? "Ajoutée toute seule à l'échéance" : 'Je te demande de confirmer le montant (pratique si ça varie, ex : CAF)'} on={autoPost} onChange={setAutoPost} />
      {initial.id && <ToggleRow label="En pause" on={paused} onChange={setPaused} />}
      <button
        class="btn block"
        disabled={!label || !parseMoney(amount) || !categoryId}
        onClick={() => {
          saveRecurring({ ...(initial as Recurring), type, label, amount: parseMoney(amount), categoryId, frequency, startDate, autoPost, paused })
          toast('Récurrente enregistrée', '🔁')
          onDone()
        }}
      >
        Enregistrer
      </button>
      {initial.id && <ConfirmButton label="Supprimer" onConfirm={() => (deleteRecurring(initial.id!), onDone())} />}
    </div>
  )
}
