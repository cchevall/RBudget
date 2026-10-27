import { useState } from 'preact/hooks'
import { contribute, deleteGoal, goalSaved, state, update } from '../store/store'
import { money, parseMoney, shortDate, vibrate } from '../lib/utils'
import { ConfirmButton, Empty, Header, Sheet, ToggleRow } from '../components/ui'
import { Jar } from '../components/charts'
import { GoalForm, monthsUntil } from './Projects'
import { go } from '../router'

export function GoalPage({ id }: { id: string }) {
  const s = state.value
  const g = s.goals.find((x) => x.id === id)
  const [amount, setAmount] = useState('')
  const [asExpense, setAsExpense] = useState(true)
  const [edit, setEdit] = useState(false)
  if (!g) return <div class="page"><Header title="Objectif" /><Empty emoji="🫥" title="Objectif introuvable" /></div>
  const saved = goalSaved(g)
  const ratio = saved / g.target
  const m = monthsUntil(g.deadline)
  const perMonth = m ? Math.max(0, g.target - saved) / m : 0
  const event = g.eventId && s.events.find((e) => e.id === g.eventId)

  const add = (cents: number) => {
    if (!cents) return
    vibrate([10, 30, 10])
    contribute(g.id, cents, asExpense)
    setAmount('')
  }

  return (
    <div class="page">
      <Header title={g.name} right={<button class="icon-btn" onClick={() => setEdit(true)}>✏️</button>} />
      <div class="card center" style={{ paddingTop: 22 }}>
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <Jar value={ratio} color={g.color} size={170} emoji={g.emoji} />
        </div>
        <div class="big num" style={{ fontSize: 34, fontWeight: 700, marginTop: 6 }}>
          {money(saved)}
        </div>
        <div class="muted">
          sur {money(g.target)} · {Math.round(ratio * 100)}%
        </div>
        {!g.doneAt && g.target > saved && <div class="small mt">Encore {money(g.target - saved)} à mettre de côté</div>}
        {g.deadline && !g.doneAt && perMonth > 0 && (
          <div class="badge mt" style={{ fontSize: 13, padding: '6px 12px' }}>
            🗓️ {money(Math.ceil(perMonth / 100) * 100)}/mois jusqu'au {shortDate(g.deadline)}
          </div>
        )}
        {g.doneAt && <div class="badge good mt" style={{ fontSize: 14, padding: '6px 12px' }}>🎉 Objectif atteint, bravo !</div>}
        {event && (
          <button class="chip mt" onClick={() => go(`/event/${event.id}`)}>
            {event.emoji} Voir le projet {event.name}
          </button>
        )}
      </div>

      <div class="card mt">
        <h3>Je mets de côté</h3>
        <div class="row wrap gap-s mt">
          {[1000, 2000, 5000, 10000].map((c) => (
            <button class="chip" onClick={() => add(c)}>
              +{money(c)}
            </button>
          ))}
        </div>
        <div class="row mt">
          <input class="input grow" inputMode="decimal" placeholder="Autre montant" value={amount} onInput={(e) => setAmount(e.currentTarget.value)} />
          <button class="btn" disabled={!parseMoney(amount)} onClick={() => add(parseMoney(amount))}>
            🐷 Ajouter
          </button>
        </div>
        <button class="btn sm ghost mt" disabled={!parseMoney(amount)} onClick={() => add(-parseMoney(amount))}>
          ↩︎ Retirer ce montant
        </button>
        <div class="mt">
          <ToggleRow label="Compter dans mes dépenses du mois" hint="Ajoute une opération « Épargne » pour que ton reste à vivre soit juste" on={asExpense} onChange={setAsExpense} />
        </div>
      </div>

      <div class="section">
        <div class="section-title">
          <h2>Historique</h2>
        </div>
        <div class="card">
          {g.contributions.length === 0 ? (
            <Empty emoji="🪙" title="La jauge attend sa première pièce !" />
          ) : (
            [...g.contributions].reverse().map((c) => (
              <div class="item">
                <span style={{ fontSize: 22 }}>{c.amount > 0 ? '🪙' : '↩️'}</span>
                <span class="grow">{shortDate(c.date)}</span>
                <b class={`num ${c.amount > 0 ? 'good' : 'bad'}`}>{money(c.amount, { sign: true })}</b>
                <button
                  class="icon-btn"
                  style={{ width: 30, height: 30, fontSize: 13 }}
                  onClick={() =>
                    update((st) => {
                      const gg = st.goals.find((x) => x.id === g.id)!
                      gg.contributions = gg.contributions.filter((x) => x.id !== c.id)
                      if (c.txId) st.transactions = st.transactions.filter((t) => t.id !== c.txId)
                      if (gg.doneAt && goalSaved(gg) < gg.target) gg.doneAt = undefined
                    }, { silent: true })
                  }
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <button
        class="btn ghost block mt-l"
        onClick={() => {
          update((st) => void (st.goals.find((x) => x.id === g.id)!.archived = true), { silent: true })
          history.back()
        }}
      >
        📦 Archiver
      </button>
      <div class="mt">
        <ConfirmButton
          label="Supprimer"
          onConfirm={() => {
            deleteGoal(g.id)
            history.back()
          }}
        />
      </div>

      <Sheet open={edit} onClose={() => setEdit(false)} title="Modifier l'objectif">
        {edit && <GoalForm goalId={g.id} onDone={() => setEdit(false)} />}
      </Sheet>
    </div>
  )
}
