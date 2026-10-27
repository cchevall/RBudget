import { useState } from 'preact/hooks'
import { cat, deleteEnvelope, setEnvelope, state, toast } from '../store/store'
import { averageByTop, envelopeAmount, envelopeStatus, forecast, spentByTop } from '../lib/stats'
import { centsToInput, currentPeriod, money, parseMoney, periodProgress, vibrate } from '../lib/utils'
import { Bar, Bubble, Empty, Header, Sheet, ToggleRow } from '../components/ui'
import { CategorySelect, PeriodSwitch } from '../components/common'
import { go } from '../router'

export function Envelopes() {
  const s = state.value
  const [period, setPeriod] = useState(currentPeriod())
  const [editing, setEditing] = useState<string | null>(null)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const statuses = s.envelopes.map((e) => envelopeStatus(s, e, period))
  const totalBudget = statuses.reduce((a, x) => a + x.budget + x.carry, 0)
  const totalSpent = statuses.reduce((a, x) => a + x.spent, 0)
  const f = forecast(s, period)
  const covered = new Set(s.envelopes.flatMap((e) => [e.categoryId, ...s.categories.filter((c) => c.parentId === e.categoryId).map((c) => c.id)]))
  const outside = spentByTop(s, period).filter(([id]) => !covered.has(id))
  const prog = period === currentPeriod() ? periodProgress(period) : undefined

  return (
    <div class="page">
      <Header title="Enveloppes" back={false} right={<button class="icon-btn" onClick={() => setEditing('new')}>＋</button>} />
      <PeriodSwitch value={period} onChange={setPeriod} />

      {s.envelopes.length > 0 && (
        <div class="hero mt">
          <div class="small" style={{ opacity: 0.9 }}>
            Dans les enveloppes
          </div>
          <div class="big">{money(totalBudget - totalSpent)}</div>
          <div class="small">
            restants sur {money(totalBudget)} · {Math.round((totalSpent / (totalBudget || 1)) * 100)}% utilisé
          </div>
          <div class="mt">
            <Bar value={totalBudget ? totalSpent / totalBudget : 0} color="#fff" tick={prog} />
          </div>
          {f.income > 0 && totalBudget > f.income && <div class="small mt">⚠️ Tes enveloppes dépassent tes revenus du mois ({money(f.income)})</div>}
        </div>
      )}

      {s.envelopes.length === 0 ? (
        <div class="card mt">
          <Empty emoji="✉️" title="Pas encore d'enveloppe" text="Une enveloppe = un montant par mois pour une catégorie. Chaque dépense est déduite automatiquement.">
            <div class="col">
              <button class="btn" onClick={() => setSuggestOpen(true)}>
                ✨ Propose-moi des enveloppes
              </button>
              <button class="btn ghost" onClick={() => setEditing('new')}>
                Créer à la main
              </button>
            </div>
          </Empty>
        </div>
      ) : (
        <>
          <div class="col mt stagger">
            {statuses
              .sort((a, b) => b.ratio - a.ratio)
              .map((st) => {
                const c = cat(st.envelope.categoryId)
                const total = st.budget + st.carry
                const color = st.left < 0 ? 'var(--bad)' : st.ratio > 0.85 ? 'var(--warn)' : c.color
                return (
                  <button class="card tap" style={{ textAlign: 'left', padding: 14 }} onClick={() => (vibrate(), setEditing(st.envelope.categoryId))} key={st.envelope.id}>
                    <div class="row">
                      <Bubble emoji={c.emoji} color={c.color} />
                      <div class="grow col gap-s">
                        <div class="row between">
                          <b>{c.name}</b>
                          <b class={`num ${st.left < 0 ? 'bad' : ''}`}>{st.left < 0 ? `−${money(-st.left)}` : money(st.left)}</b>
                        </div>
                        <Bar value={total ? st.spent / total : st.spent ? 1 : 0} color={color} tick={prog} />
                        <div class="row between tiny muted">
                          <span>
                            {money(st.spent)} / {money(total)}
                            {st.carry !== 0 && ` (report ${money(st.carry, { sign: true })})`}
                          </span>
                          {prog !== undefined && st.projected > total * 1.05 && total > 0 && <span class="warn bold">🏎️ ~{money(Math.round(st.projected))} fin de mois</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
          </div>
          <button class="btn ghost block mt" onClick={() => setSuggestOpen(true)}>
            ✨ Ajuster avec mes moyennes
          </button>
        </>
      )}

      {outside.length > 0 && (
        <div class="section">
          <div class="section-title">
            <h2>Hors enveloppes</h2>
          </div>
          <div class="card">
            {outside.map(([id, v]) => (
              <div class="item" onClick={() => setEditing(id)}>
                <Bubble emoji={cat(id).emoji} color={cat(id).color} size="sm" />
                <span class="grow">{cat(id).name}</span>
                <b class="num">{money(v)}</b>
                <span class="badge">+ enveloppe</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nouvelle enveloppe' : 'Enveloppe'}>
        {editing && <EnvelopeForm key={editing} categoryId={editing === 'new' ? '' : editing} period={period} onDone={() => setEditing(null)} />}
      </Sheet>
      <Sheet open={suggestOpen} onClose={() => setSuggestOpen(false)} title="✨ Enveloppes suggérées">
        {suggestOpen && <Suggest onDone={() => setSuggestOpen(false)} />}
      </Sheet>
    </div>
  )
}

function EnvelopeForm({ categoryId, period, onDone }: { categoryId: string; period: string; onDone: () => void }) {
  const s = state.value
  const existing = s.envelopes.find((e) => e.categoryId === categoryId)
  const [catId, setCatId] = useState(categoryId)
  const [amount, setAmount] = useState(existing ? centsToInput(envelopeAmount(existing, period)) : '')
  const [rollover, setRollover] = useState(existing?.rollover ?? false)
  const avg = averageByTop(s, 3).get(catId)
  return (
    <div class="form">
      {!existing && (
        <label class="field">
          <span>Catégorie</span>
          <CategorySelect value={catId} onChange={setCatId} kind="expense" />
        </label>
      )}
      {existing && (
        <div class="row">
          <Bubble emoji={cat(catId).emoji} color={cat(catId).color} size="lg" />
          <h2 style={{ margin: 0 }}>{cat(catId).name}</h2>
        </div>
      )}
      <label class="field">
        <span>Montant par mois</span>
        <input class="input" inputMode="decimal" placeholder="200" value={amount} onInput={(e) => setAmount(e.currentTarget.value)} />
      </label>
      {avg !== undefined && avg > 0 && (
        <button class="chip" onClick={() => setAmount(centsToInput(Math.ceil(avg / 500) * 500))}>
          💡 Moyenne 3 derniers mois : {money(Math.round(avg))}
        </button>
      )}
      <ToggleRow label="🔁 Report du reste" hint="Ce qui n'est pas dépensé s'ajoute au mois suivant (et les dépassements se déduisent)" on={rollover} onChange={setRollover} />
      <button
        class="btn block"
        disabled={!catId || !parseMoney(amount)}
        onClick={() => {
          setEnvelope(catId, parseMoney(amount), rollover, period)
          toast('Enveloppe enregistrée', '✉️')
          onDone()
        }}
      >
        Enregistrer
      </button>
      {existing && (
        <>
          <button class="btn ghost block" onClick={() => (onDone(), go(`/tx?cat=${catId}`))}>
            Voir les opérations
          </button>
          <button class="btn danger block" onClick={() => (deleteEnvelope(catId), onDone())}>
            Supprimer l'enveloppe
          </button>
        </>
      )}
    </div>
  )
}

/** Proposes envelopes from the last 3 months averages (or sensible defaults if no history) */
function Suggest({ onDone }: { onDone: () => void }) {
  const s = state.value
  const avg = averageByTop(s, 3)
  const FIXED = new Set(['credit-voiture', 'matmut', 'assu-lunettes', 'logement', 'epargne', 'abonnements'])
  const DEFAULTS: [string, number][] = [['courses', 50000], ['boulangerie', 4000], ['resto', 8000], ['enfants', 30000], ['sante', 6000], ['cadeaux', 5000], ['sorties', 6000], ['coiffeuse', 3000], ['estheticienne', 3000], ['shopping', 8000]]
  const base: [string, number][] = avg.size ? [...avg.entries()].filter(([id, v]) => v > 1000 && !FIXED.has(id)).sort((a, b) => b[1] - a[1]) : DEFAULTS
  const [rows, setRows] = useState(() => base.map(([id, v]) => ({ id, on: true, amount: centsToInput(Math.ceil(v / 500) * 500) })))
  return (
    <div class="form">
      <p class="small muted">{avg.size ? 'Basé sur ta moyenne des 3 derniers mois, arrondi au 5 € supérieur. Ajuste si besoin !' : "Pas encore d'historique : voici des montants de départ, à ajuster."}</p>
      {rows.map((r, i) => (
        <div class="row">
          <button class={`check ${r.on ? 'on' : ''}`} onClick={() => setRows(rows.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}>
            {r.on ? '✓' : ''}
          </button>
          <Bubble emoji={cat(r.id).emoji} color={cat(r.id).color} size="sm" />
          <span class="grow">{cat(r.id).name}</span>
          <input class="input" inputMode="decimal" style={{ width: 96, minHeight: 40, textAlign: 'right' }} value={r.amount} onInput={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: e.currentTarget.value } : x)))} />
        </div>
      ))}
      <button
        class="btn block"
        onClick={() => {
          const p = currentPeriod()
          for (const r of rows) if (r.on && parseMoney(r.amount)) setEnvelope(r.id, parseMoney(r.amount), false, p)
          toast('Enveloppes créées !', '✉️')
          onDone()
        }}
      >
        Créer {rows.filter((r) => r.on).length} enveloppes
      </button>
    </div>
  )
}
