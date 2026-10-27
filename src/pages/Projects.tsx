import { useState } from 'preact/hooks'
import { goalSaved, saveEvent, saveGoal, state } from '../store/store'
import type { EventBudget } from '../store/types'
import { centsToInput, daysBetween, money, parseMoney, today } from '../lib/utils'
import { Bar, Empty, Header, Sheet } from '../components/ui'
import { ColorPicker, EmojiPicker, PASTELS } from '../components/common'
import { Jar } from '../components/charts'
import { go } from '../router'

export const monthsUntil = (d?: string) => (d ? Math.max(1, Math.ceil(daysBetween(today(), d) / 30.4)) : 0)

export function eventTotals(e: EventBudget) {
  if (e.kind === 'christmas') {
    const planned = e.gifts.reduce((a, g) => a + g.price, 0)
    const spent = e.gifts.filter((g) => g.status === 'toWrap' || g.status === 'ready').reduce((a, g) => a + g.price, 0)
    return { planned, spent, count: e.gifts.length, done: e.gifts.filter((g) => g.status === 'ready').length }
  }
  const planned = e.items.reduce((a, i) => a + i.planned, 0)
  const spent = e.items.filter((i) => i.paid).reduce((a, i) => a + (i.actual ?? i.planned), 0)
  return { planned, spent, count: e.items.length, done: e.items.filter((i) => i.paid).length }
}

export function Projects() {
  const s = state.value
  const [newGoal, setNewGoal] = useState(false)
  const [newEvent, setNewEvent] = useState<EventBudget['kind'] | null>(null)
  const goals = s.goals.filter((g) => !g.archived)
  const events = s.events.filter((e) => !e.archived)
  const hasXmas = events.some((e) => e.kind === 'christmas' && (e.date ?? '') >= today())

  return (
    <div class="page">
      <Header title="Projets" />
      <div class="row gap-s">
        <button class="btn sm grow" onClick={() => setNewGoal(true)}>
          🎯 Objectif
        </button>
        <button class="btn sm ghost grow" onClick={() => setNewEvent('christmas')}>
          🎄 Noël
        </button>
        <button class="btn sm ghost grow" onClick={() => setNewEvent('trip')}>
          🏖️ Vacances
        </button>
      </div>

      {!hasXmas && new Date().getMonth() >= 8 && (
        <button class="card tap mt" style={{ width: '100%', textAlign: 'left', background: 'var(--good-soft)', borderColor: 'transparent' }} onClick={() => setNewEvent('christmas')}>
          <div class="row">
            <span style={{ fontSize: 34 }} class="float">
              🎅
            </span>
            <div>
              <b>Noël approche !</b>
              <div class="small muted">Prépare ta liste de cadeaux et ton budget dès maintenant.</div>
            </div>
          </div>
        </button>
      )}

      <div class="section">
        <div class="section-title">
          <h2>🎯 Mes objectifs d'épargne</h2>
        </div>
        {goals.length === 0 ? (
          <div class="card">
            <Empty emoji="🫙" title="Aucun objectif" text="Ex : « 2 000 € pour les vacances » — remplis la jauge au fil des mois." />
          </div>
        ) : (
          <div class="col stagger">
            {goals.map((g) => {
              const saved = goalSaved(g)
              const m = monthsUntil(g.deadline)
              const perMonth = m ? Math.max(0, g.target - saved) / m : 0
              return (
                <button class="card tap" style={{ textAlign: 'left' }} onClick={() => go(`/goal/${g.id}`)} key={g.id}>
                  <div class="row gap-l">
                    <Jar value={saved / g.target} color={g.color} size={78} emoji={g.emoji} />
                    <div class="grow col gap-s">
                      <div class="row between">
                        <b>{g.name}</b>
                        {g.doneAt && <span class="badge good">Atteint 🎉</span>}
                      </div>
                      <div class="num">
                        <b>{money(saved)}</b> <span class="muted small">/ {money(g.target)}</span>
                      </div>
                      <Bar value={saved / g.target} color={g.color} kind="thin" />
                      {g.deadline && !g.doneAt && <div class="tiny muted">{perMonth > 0 ? `${money(Math.ceil(perMonth / 100) * 100)}/mois pendant ${m} mois` : 'Pile dans les temps ✨'}</div>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div class="section">
        <div class="section-title">
          <h2>🎁 Budgets de projets</h2>
        </div>
        {events.length === 0 ? (
          <div class="card">
            <Empty emoji="🎄" title="Aucun projet" text="Noël (liste de cadeaux, à acheter / à emballer / prêt), vacances (budget + checklist)…">
              <button class="btn ghost" onClick={() => setNewEvent('custom')}>
                🎉 Autre projet
              </button>
            </Empty>
          </div>
        ) : (
          <div class="col stagger">
            {events.map((e) => {
              const t = eventTotals(e)
              return (
                <button class="card tap" style={{ textAlign: 'left' }} onClick={() => go(`/event/${e.id}`)} key={e.id}>
                  <div class="row">
                    <span style={{ fontSize: 36 }}>{e.emoji}</span>
                    <div class="grow col gap-s">
                      <div class="row between">
                        <b>{e.name}</b>
                        {e.date && e.date >= today() && <span class="badge">J-{daysBetween(today(), e.date)}</span>}
                      </div>
                      <Bar value={e.budget ? t.planned / e.budget : 0} color={t.planned > e.budget && e.budget ? 'var(--bad)' : undefined} kind="thin" />
                      <div class="tiny muted">
                        {money(t.planned)} prévus / {money(e.budget)} · {t.done}/{t.count} {e.kind === 'christmas' ? 'cadeaux prêts' : 'payés'}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
            <button class="btn ghost" onClick={() => setNewEvent('custom')}>
              🎉 Autre projet
            </button>
          </div>
        )}
      </div>

      <Sheet open={newGoal} onClose={() => setNewGoal(false)} title="Nouvel objectif">
        {newGoal && <GoalForm onDone={(id) => (setNewGoal(false), id && go(`/goal/${id}`))} />}
      </Sheet>
      <Sheet open={!!newEvent} onClose={() => setNewEvent(null)} title={newEvent === 'christmas' ? '🎄 Budget de Noël' : newEvent === 'trip' ? '🏖️ Vacances' : '🎉 Nouveau projet'}>
        {newEvent && <EventForm kind={newEvent} onDone={(id) => (setNewEvent(null), id && go(`/event/${id}`))} />}
      </Sheet>
    </div>
  )
}

export function GoalForm({ goalId, onDone, preset }: { goalId?: string; onDone: (id?: string) => void; preset?: { name: string; emoji: string; eventId?: string; deadline?: string; target?: number } }) {
  const g = state.value.goals.find((x) => x.id === goalId)
  const [name, setName] = useState(g?.name ?? preset?.name ?? '')
  const [target, setTarget] = useState(centsToInput(g?.target ?? preset?.target ?? 0))
  const [emoji, setEmoji] = useState(g?.emoji ?? preset?.emoji ?? '🎯')
  const [color, setColor] = useState(g?.color ?? PASTELS[0])
  const [deadline, setDeadline] = useState(g?.deadline ?? preset?.deadline ?? '')
  return (
    <div class="form">
      <label class="field">
        <span>Nom</span>
        <input class="input" placeholder="Vacances d'été, nouvelle voiture…" value={name} onInput={(e) => setName(e.currentTarget.value)} />
      </label>
      <div class="grid2">
        <label class="field">
          <span>Objectif (€)</span>
          <input class="input" inputMode="decimal" placeholder="2000" value={target} onInput={(e) => setTarget(e.currentTarget.value)} />
        </label>
        <label class="field">
          <span>Échéance (optionnel)</span>
          <input class="input" type="date" value={deadline} onInput={(e) => setDeadline(e.currentTarget.value)} />
        </label>
      </div>
      <div class="field">
        <span>Emoji</span>
        <EmojiPicker value={emoji} onChange={setEmoji} />
      </div>
      <div class="field">
        <span>Couleur de la jauge</span>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <button class="btn block" disabled={!name || !parseMoney(target)} onClick={() => onDone(saveGoal({ id: goalId, name, target: parseMoney(target), emoji, color, deadline: deadline || undefined, eventId: g?.eventId ?? preset?.eventId }))}>
        {goalId ? 'Enregistrer' : 'Créer ma jauge 🫙'}
      </button>
    </div>
  )
}

export function EventForm({ kind, eventId, onDone }: { kind: EventBudget['kind']; eventId?: string; onDone: (id?: string) => void }) {
  const e = state.value.events.find((x) => x.id === eventId)
  const y = new Date().getFullYear()
  const xmas = `${new Date().getMonth() === 11 && new Date().getDate() > 25 ? y + 1 : y}-12-25`
  const [name, setName] = useState(e?.name ?? (kind === 'christmas' ? `Noël ${xmas.slice(0, 4)}` : kind === 'trip' ? 'Vacances' : ''))
  const [budget, setBudget] = useState(centsToInput(e?.budget ?? 0))
  const [date, setDate] = useState(e?.date ?? (kind === 'christmas' ? xmas : ''))
  const [emoji, setEmoji] = useState(e?.emoji ?? (kind === 'christmas' ? '🎄' : kind === 'trip' ? '🏖️' : '🎉'))
  const [autoLog, setAutoLog] = useState(e?.autoLog ?? true)
  return (
    <div class="form">
      <label class="field">
        <span>Nom</span>
        <input class="input" value={name} placeholder="Anniversaire de Léa, Week-end à Rome…" onInput={(ev) => setName(ev.currentTarget.value)} />
      </label>
      <div class="grid2">
        <label class="field">
          <span>Budget total (€)</span>
          <input class="input" inputMode="decimal" placeholder="500" value={budget} onInput={(ev) => setBudget(ev.currentTarget.value)} />
        </label>
        <label class="field">
          <span>Date</span>
          <input class="input" type="date" value={date} onInput={(ev) => setDate(ev.currentTarget.value)} />
        </label>
      </div>
      <div class="field">
        <span>Emoji</span>
        <EmojiPicker value={emoji} onChange={setEmoji} />
      </div>
      <label class="toggle-row">
        <div>
          <div class="bold">Enregistrer les achats comme dépenses</div>
          <div class="small muted">{kind === 'christmas' ? 'Un cadeau acheté = une dépense « Noël » ajoutée automatiquement' : 'Une ligne payée = une dépense ajoutée automatiquement'}</div>
        </div>
        <button type="button" class={`switch ${autoLog ? 'on' : ''}`} onClick={() => setAutoLog(!autoLog)} />
      </label>
      <button class="btn block" disabled={!name} onClick={() => onDone(saveEvent({ id: eventId, kind: e?.kind ?? kind, name, budget: parseMoney(budget), date: date || undefined, emoji, autoLog }))}>
        {eventId ? 'Enregistrer' : "C'est parti !"}
      </button>
    </div>
  )
}
