import { useState } from 'preact/hooks'
import { deleteEvent, deleteGift, deleteTripItem, GIFT_FLOW, goalSaved, mutateEvent, saveGift, saveTripItem, state, fireConfetti } from '../store/store'
import type { EventBudget, Gift, GiftStatus, TripItem } from '../store/types'
import { centsToInput, daysBetween, money, parseMoney, today, uid, vibrate } from '../lib/utils'
import { Bar, ConfirmButton, Empty, Header, Seg, Sheet } from '../components/ui'
import { Jar } from '../components/charts'
import { EventForm, eventTotals, GoalForm } from './Projects'
import { go } from '../router'

export const GIFT_LABEL: Record<GiftStatus, string> = { idea: '💡 Idée', toBuy: '🛒 À acheter', toWrap: '🎀 À emballer', ready: '✅ Prêt' }
const TRIP_KIND: Record<TripItem['kind'], string> = { transport: '🚗 Transport', logement: '🏡 Logement', activite: '🎢 Activités', repas: '🍽️ Repas', autre: '✨ Autre' }

export function EventPage({ id }: { id: string }) {
  const s = state.value
  const e = s.events.find((x) => x.id === id)
  const [edit, setEdit] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  if (!e) return <div class="page"><Header title="Projet" /><Empty emoji="🫥" title="Projet introuvable" /></div>
  const t = eventTotals(e)
  const goal = s.goals.find((g) => g.eventId === e.id)
  const days = e.date ? daysBetween(today(), e.date) : null

  return (
    <div class="page">
      <Header title={`${e.emoji} ${e.name}`} right={<button class="icon-btn" onClick={() => setEdit(true)}>✏️</button>} />

      <div class="hero">
        <div class="row between">
          <div class="small" style={{ opacity: 0.9 }}>
            {e.kind === 'christmas' ? 'Cadeaux prévus' : 'Budget prévu'}
          </div>
          {days !== null && days >= 0 && <div class="badge" style={{ background: 'rgba(255,255,255,.25)', color: '#fff' }}>{days === 0 ? "C'est aujourd'hui ! 🎉" : `J-${days}`}</div>}
        </div>
        <div class="big">{money(t.planned)}</div>
        <div class="small">sur un budget de {money(e.budget)} · {money(t.spent)} déjà {e.kind === 'christmas' ? 'achetés' : 'payés'}</div>
        <div class="mt">
          <Bar value={e.budget ? t.planned / e.budget : 0} color="#fff" />
        </div>
        {e.budget > 0 && t.planned > e.budget && <div class="small mt">⚠️ {money(t.planned - e.budget)} au-dessus du budget</div>}
      </div>

      {/* Savings jar linked to this project */}
      {goal ? (
        <button class="card tap mt" style={{ width: '100%', textAlign: 'left' }} onClick={() => go(`/goal/${goal.id}`)}>
          <div class="row">
            <Jar value={goalSaved(goal) / goal.target} color={goal.color} size={60} emoji="🐷" />
            <div class="grow">
              <b>Cagnotte du projet</b>
              <div class="small muted">
                {money(goalSaved(goal))} / {money(goal.target)} mis de côté
              </div>
            </div>
            <span>›</span>
          </div>
        </button>
      ) : (
        <button class="card tap mt" style={{ width: '100%', textAlign: 'left' }} onClick={() => setGoalOpen(true)}>
          <div class="row">
            <span style={{ fontSize: 30 }}>🫙</span>
            <div class="grow">
              <b>Créer une cagnotte</b>
              <div class="small muted">Une jauge pour mettre de côté petit à petit d'ici le jour J</div>
            </div>
            <span>＋</span>
          </div>
        </button>
      )}

      {e.kind === 'christmas' ? <Christmas e={e} /> : <Trip e={e} />}

      <div class="mt-l col">
        <button class="btn ghost block" onClick={() => (mutateEvent(e.id, (x) => void (x.archived = true)), history.back())}>
          📦 Archiver le projet
        </button>
        <ConfirmButton label="Supprimer le projet" onConfirm={() => (deleteEvent(e.id), history.back())} />
      </div>

      <Sheet open={edit} onClose={() => setEdit(false)} title="Modifier le projet">
        {edit && <EventForm kind={e.kind} eventId={e.id} onDone={() => setEdit(false)} />}
      </Sheet>
      <Sheet open={goalOpen} onClose={() => setGoalOpen(false)} title="🫙 Cagnotte du projet">
        {goalOpen && <GoalForm preset={{ name: e.name, emoji: e.emoji, eventId: e.id, deadline: e.date, target: e.budget }} onDone={() => setGoalOpen(false)} />}
      </Sheet>
    </div>
  )
}

// ---------- Christmas ----------

function Christmas({ e }: { e: EventBudget }) {
  const [filter, setFilter] = useState<GiftStatus | 'all'>('all')
  const [giftEdit, setGiftEdit] = useState<Gift | null>(null)
  const [personOpen, setPersonOpen] = useState(false)
  const people = [...new Set([...e.people.map((p) => p.name), ...e.gifts.map((g) => g.person)])]
  const counts = Object.fromEntries(GIFT_FLOW.map((st) => [st, e.gifts.filter((g) => g.status === st).length])) as Record<GiftStatus, number>

  const cycle = (g: Gift) => {
    vibrate(12)
    const next = GIFT_FLOW[(GIFT_FLOW.indexOf(g.status) + 1) % GIFT_FLOW.length]
    saveGift(e.id, { ...g, status: next })
    if (next === 'ready' && e.gifts.every((x) => x.id === g.id || x.status === 'ready')) fireConfetti()
  }
  const newGift = (person = people[0] ?? ''): Gift => ({ id: uid(), person, title: '', price: 0, status: 'idea' })

  return (
    <>
      <div class="chips mt">
        <button class={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
          Tous · {e.gifts.length}
        </button>
        {GIFT_FLOW.map((st) => (
          <button class={`chip ${filter === st ? 'on' : ''}`} onClick={() => setFilter(filter === st ? 'all' : st)}>
            {GIFT_LABEL[st]} · {counts[st]}
          </button>
        ))}
      </div>

      {people.length === 0 && (
        <div class="card mt">
          <Empty emoji="🧑‍🎄" title="Pour qui sont les cadeaux ?" text="Ajoute les personnes (avec un budget chacun si tu veux), puis leurs cadeaux.">
            <button class="btn" onClick={() => setPersonOpen(true)}>
              ＋ Ajouter une personne
            </button>
          </Empty>
        </div>
      )}

      {people.map((name) => {
        const p = e.people.find((x) => x.name === name)
        const gifts = e.gifts.filter((g) => g.person === name)
        const shown = gifts.filter((g) => filter === 'all' || g.status === filter)
        const total = gifts.reduce((a, g) => a + g.price, 0)
        if (filter !== 'all' && !shown.length) return null
        return (
          <div class="card mt" key={name}>
            <div class="row between">
              <h3>🎅 {name}</h3>
              <span class={`small num ${p?.budget && total > p.budget ? 'bad bold' : 'muted'}`}>
                {money(total)}
                {p?.budget ? ` / ${money(p.budget)}` : ''}
              </span>
            </div>
            {p?.budget ? (
              <div class="mt" style={{ marginBottom: 4 }}>
                <Bar value={total / p.budget} kind="thin" color={total > p.budget ? 'var(--bad)' : undefined} />
              </div>
            ) : null}
            {shown.map((g) => (
              <div class="item" key={g.id}>
                <button class="grow" style={{ textAlign: 'left' }} onClick={() => setGiftEdit(g)}>
                  <div class={`bold ${g.status === 'ready' ? 'done-text' : ''}`}>{g.title || 'Cadeau mystère'}</div>
                  <div class="tiny muted">
                    {money(g.price)}
                    {g.where ? ` · ${g.where}` : ''}
                  </div>
                </button>
                <button class={`status-pill st-${g.status}`} onClick={() => cycle(g)} key={g.status} style={{ animation: 'pop-in .4s var(--spring)' }}>
                  {GIFT_LABEL[g.status]}
                </button>
              </div>
            ))}
            <button class="btn sm ghost mt" onClick={() => setGiftEdit(newGift(name))}>
              ＋ Cadeau pour {name}
            </button>
          </div>
        )
      })}

      {people.length > 0 && (
        <button class="btn white block mt" onClick={() => setPersonOpen(true)}>
          ＋ Ajouter une personne
        </button>
      )}
      <p class="tiny muted center mt">Astuce : appuie sur le statut d'un cadeau pour le faire avancer 💡 → 🛒 → 🎀 → ✅</p>

      <Sheet open={!!giftEdit} onClose={() => setGiftEdit(null)} title={giftEdit && e.gifts.some((g) => g.id === giftEdit.id) ? 'Modifier le cadeau' : 'Nouveau cadeau'}>
        {giftEdit && <GiftForm e={e} gift={giftEdit} people={people} onDone={() => setGiftEdit(null)} />}
      </Sheet>
      <Sheet open={personOpen} onClose={() => setPersonOpen(false)} title="Nouvelle personne">
        {personOpen && <PersonForm e={e} onDone={() => setPersonOpen(false)} />}
      </Sheet>
    </>
  )
}

function GiftForm({ e, gift, people, onDone }: { e: EventBudget; gift: Gift; people: string[]; onDone: () => void }) {
  const [g, setG] = useState({ ...gift, priceRaw: centsToInput(gift.price) })
  const exists = e.gifts.some((x) => x.id === gift.id)
  return (
    <div class="form">
      <label class="field">
        <span>Pour qui ?</span>
        <input class="input" list="people" value={g.person} onInput={(ev) => setG({ ...g, person: ev.currentTarget.value })} />
        <datalist id="people">
          {people.map((p) => (
            <option value={p} />
          ))}
        </datalist>
      </label>
      <label class="field">
        <span>Cadeau</span>
        <input class="input" placeholder="Lego, livre, pull tout doux…" value={g.title} onInput={(ev) => setG({ ...g, title: ev.currentTarget.value })} />
      </label>
      <div class="grid2">
        <label class="field">
          <span>Prix</span>
          <input class="input" inputMode="decimal" value={g.priceRaw} onInput={(ev) => setG({ ...g, priceRaw: ev.currentTarget.value })} />
        </label>
        <label class="field">
          <span>Où ?</span>
          <input class="input" placeholder="Fnac, Amazon…" value={g.where ?? ''} onInput={(ev) => setG({ ...g, where: ev.currentTarget.value })} />
        </label>
      </div>
      <div class="field">
        <span>Statut</span>
        <div class="chips wrap" style={{ flexWrap: 'wrap' }}>
          {GIFT_FLOW.map((st) => (
            <button class={`chip ${g.status === st ? 'on' : ''}`} onClick={() => setG({ ...g, status: st })}>
              {GIFT_LABEL[st]}
            </button>
          ))}
        </div>
      </div>
      <button
        class="btn block"
        disabled={!g.person.trim()}
        onClick={() => {
          const { priceRaw, ...rest } = g
          saveGift(e.id, { ...rest, person: rest.person.trim(), price: parseMoney(priceRaw) })
          onDone()
        }}
      >
        {exists ? 'Enregistrer' : 'Ajouter 🎁'}
      </button>
      {exists && <ConfirmButton label="Supprimer" onConfirm={() => (deleteGift(e.id, gift.id), onDone())} />}
    </div>
  )
}

function PersonForm({ e, onDone }: { e: EventBudget; onDone: () => void }) {
  const [name, setName] = useState('')
  const [budget, setBudget] = useState('')
  return (
    <div class="form">
      <label class="field">
        <span>Prénom</span>
        <input class="input" placeholder="Mamie, Léo, Tata Sophie…" value={name} onInput={(ev) => setName(ev.currentTarget.value)} />
      </label>
      <label class="field">
        <span>Budget pour cette personne (optionnel)</span>
        <input class="input" inputMode="decimal" placeholder="50" value={budget} onInput={(ev) => setBudget(ev.currentTarget.value)} />
      </label>
      <button
        class="btn block"
        disabled={!name.trim()}
        onClick={() => {
          mutateEvent(e.id, (x) => {
            x.people = x.people.filter((p) => p.name !== name.trim())
            x.people.push({ name: name.trim(), budget: parseMoney(budget) })
          })
          onDone()
        }}
      >
        Ajouter
      </button>
    </div>
  )
}

// ---------- Trip / custom ----------

function Trip({ e }: { e: EventBudget }) {
  const [tab, setTab] = useState<'budget' | 'checklist'>('budget')
  const [itemEdit, setItemEdit] = useState<TripItem | null>(null)
  const [text, setText] = useState('')
  const done = e.checklist.filter((c) => c.done).length
  const kinds = Object.keys(TRIP_KIND) as TripItem['kind'][]
  return (
    <>
      <div class="mt">
        <Seg value={tab} onChange={setTab} options={[['budget', '💶 Budget'], ['checklist', `✅ Checklist ${e.checklist.length ? `${done}/${e.checklist.length}` : ''}`]]} />
      </div>

      {tab === 'budget' ? (
        <>
          {e.items.length === 0 && (
            <div class="card mt">
              <Empty emoji="🧳" title="Rien de prévu pour l'instant" text="Ajoute le transport, le logement, les activités… avec un prix prévu, puis coche quand c'est payé." />
            </div>
          )}
          {kinds.map((k) => {
            const items = e.items.filter((i) => i.kind === k)
            if (!items.length) return null
            return (
              <div class="card mt" key={k}>
                <div class="row between">
                  <h3>{TRIP_KIND[k]}</h3>
                  <span class="small muted num">{money(items.reduce((a, i) => a + (i.paid ? i.actual ?? i.planned : i.planned), 0))}</span>
                </div>
                {items.map((i) => (
                  <div class="item">
                    <button class={`check ${i.paid ? 'on' : ''}`} onClick={() => (vibrate(), saveTripItem(e.id, { ...i, paid: !i.paid }))}>
                      {i.paid ? '✓' : ''}
                    </button>
                    <button class="grow" style={{ textAlign: 'left' }} onClick={() => setItemEdit(i)}>
                      <div class={i.paid ? 'done-text' : 'bold'}>{i.title}</div>
                      <div class="tiny muted">
                        prévu {money(i.planned)}
                        {i.actual !== undefined && i.actual !== i.planned ? ` · réel ${money(i.actual)}` : ''}
                      </div>
                    </button>
                    {i.actual !== undefined && i.actual !== i.planned && <span class={`badge ${i.actual > i.planned ? 'bad' : 'good'}`}>{money(i.actual - i.planned, { sign: true })}</span>}
                  </div>
                ))}
              </div>
            )
          })}
          <button class="btn white block mt" onClick={() => setItemEdit({ id: uid(), title: '', kind: 'activite', planned: 0, paid: false })}>
            ＋ Ajouter une dépense prévue
          </button>
        </>
      ) : (
        <div class="card mt">
          <div class="row">
            <input
              class="input grow"
              placeholder="Passeports, crème solaire, doudou…"
              value={text}
              onInput={(ev) => setText(ev.currentTarget.value)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' && text.trim()) {
                  mutateEvent(e.id, (x) => void x.checklist.push({ id: uid(), text: text.trim(), done: false }))
                  setText('')
                }
              }}
            />
            <button
              class="icon-btn"
              onClick={() => {
                if (!text.trim()) return
                mutateEvent(e.id, (x) => void x.checklist.push({ id: uid(), text: text.trim(), done: false }))
                setText('')
              }}
            >
              ＋
            </button>
          </div>
          {e.checklist.length > 0 && (
            <div class="mt">
              <Bar value={done / e.checklist.length} kind="thin" color="var(--good)" />
            </div>
          )}
          {e.checklist.map((c) => (
            <div class="item" key={c.id}>
              <button
                class={`check ${c.done ? 'on' : ''}`}
                onClick={() => {
                  vibrate()
                  mutateEvent(e.id, (x) => {
                    const it = x.checklist.find((y) => y.id === c.id)!
                    it.done = !it.done
                  })
                  if (!c.done && done + 1 === e.checklist.length) fireConfetti()
                }}
              >
                {c.done ? '✓' : ''}
              </button>
              <span class={`grow ${c.done ? 'done-text' : ''}`}>{c.text}</span>
              <button class="faint" onClick={() => mutateEvent(e.id, (x) => void (x.checklist = x.checklist.filter((y) => y.id !== c.id)))}>
                ✕
              </button>
            </div>
          ))}
          {e.checklist.length === 0 && <p class="small muted center mt">Ta liste de choses à ne pas oublier 📝</p>}
        </div>
      )}

      <Sheet open={!!itemEdit} onClose={() => setItemEdit(null)} title="Dépense prévue">
        {itemEdit && <TripItemForm e={e} item={itemEdit} onDone={() => setItemEdit(null)} />}
      </Sheet>
    </>
  )
}

function TripItemForm({ e, item, onDone }: { e: EventBudget; item: TripItem; onDone: () => void }) {
  const exists = e.items.some((i) => i.id === item.id)
  const [title, setTitle] = useState(item.title)
  const [kind, setKind] = useState(item.kind)
  const [planned, setPlanned] = useState(centsToInput(item.planned))
  const [actual, setActual] = useState(item.actual !== undefined ? centsToInput(item.actual) : '')
  const [paid, setPaid] = useState(item.paid)
  return (
    <div class="form">
      <label class="field">
        <span>Quoi ?</span>
        <input class="input" placeholder="Location, billets de train, parc d'attractions…" value={title} onInput={(ev) => setTitle(ev.currentTarget.value)} />
      </label>
      <div class="chips wrap" style={{ flexWrap: 'wrap' }}>
        {(Object.keys(TRIP_KIND) as TripItem['kind'][]).map((k) => (
          <button class={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>
            {TRIP_KIND[k]}
          </button>
        ))}
      </div>
      <div class="grid2">
        <label class="field">
          <span>Prix prévu</span>
          <input class="input" inputMode="decimal" value={planned} onInput={(ev) => setPlanned(ev.currentTarget.value)} />
        </label>
        <label class="field">
          <span>Prix réel</span>
          <input class="input" inputMode="decimal" placeholder="si différent" value={actual} onInput={(ev) => setActual(ev.currentTarget.value)} />
        </label>
      </div>
      <label class="toggle-row">
        <div class="bold">C'est payé ✓</div>
        <button type="button" class={`switch ${paid ? 'on' : ''}`} onClick={() => setPaid(!paid)} />
      </label>
      <button
        class="btn block"
        disabled={!title.trim()}
        onClick={() => {
          saveTripItem(e.id, { ...item, title: title.trim(), kind, planned: parseMoney(planned), actual: actual ? parseMoney(actual) : undefined, paid })
          onDone()
        }}
      >
        {exists ? 'Enregistrer' : 'Ajouter'}
      </button>
      {exists && <ConfirmButton label="Supprimer" onConfirm={() => (deleteTripItem(e.id, item.id), onDone())} />}
    </div>
  )
}
