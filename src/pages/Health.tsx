import { useState } from 'preact/hooks'
import { cat, markReimbursed, state } from '../store/store'
import type { Transaction } from '../store/types'
import { centsToInput, daysBetween, money, parseMoney, shortDate, today } from '../lib/utils'
import { Bubble, Empty, Header, Seg } from '../components/ui'
import { openAdd, openEdit } from '../components/AddSheet'

const waitingSecu = (t: Transaction) => !!t.reimb && t.reimb.secu > 0 && !t.reimb.secuAt
const waitingMut = (t: Transaction) => !!t.reimb && t.reimb.mutuelle > 0 && !t.reimb.mutuelleAt

export function Health() {
  const s = state.value
  const [tab, setTab] = useState<'waiting' | 'done'>('waiting')
  const all = s.transactions.filter((t) => t.reimb).sort((a, b) => b.date.localeCompare(a.date))
  const waiting = all.filter((t) => waitingSecu(t) || waitingMut(t))
  const done = all.filter((t) => !waitingSecu(t) && !waitingMut(t))
  const due = waiting.reduce((a, t) => a + (waitingSecu(t) ? t.reimb!.secu : 0) + (waitingMut(t) ? t.reimb!.mutuelle : 0), 0)
  const year = today().slice(0, 4)
  const healthYear = s.transactions.filter((t) => t.date.startsWith(year) && (cat(t.categoryId).id === 'sante' || cat(t.categoryId).parentId === 'sante' || t.categoryId === 'enf-sante'))
  const spentYear = healthYear.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0)
  const backYear = s.transactions.filter((t) => t.date.startsWith(year) && t.reimbOf).reduce((a, t) => a + t.amount, 0)
  const list = tab === 'waiting' ? waiting : done

  return (
    <div class="page">
      <Header title="Santé & remboursements" />
      <div class="hero">
        <div class="small" style={{ opacity: 0.9 }}>
          En attente de remboursement
        </div>
        <div class="big">{money(due)}</div>
        <div class="row mt" style={{ gap: 8 }}>
          <div class="pill">
            <span>Santé {year}</span>
            <b>{money(spentYear)}</b>
          </div>
          <div class="pill">
            <span>Remboursé</span>
            <b>{money(backYear)}</b>
          </div>
          <div class="pill">
            <span>Reste à charge</span>
            <b>{money(spentYear - backYear)}</b>
          </div>
        </div>
      </div>

      <button class="btn block mt" onClick={() => openAdd({ type: 'expense', categoryId: 'sante-medecin' })}>
        ＋ Nouvelle dépense santé
      </button>

      <div class="mt">
        <Seg value={tab} onChange={setTab} options={[['waiting', `⏳ En attente (${waiting.length})`], ['done', `✅ Remboursés (${done.length})`]]} />
      </div>

      {list.length === 0 ? (
        <div class="card mt">
          <Empty emoji={tab === 'waiting' ? '💚' : '🩺'} title={tab === 'waiting' ? 'Aucun remboursement en attente' : 'Rien encore'} text="Ajoute une dépense Médecin, Kiné, Ostéo, Pharmacie ou Santé enfants : le suivi Sécu/mutuelle s'active tout seul." />
        </div>
      ) : (
        <div class="col mt stagger">
          {list.map((t) => (
            <ReimbCard t={t} key={t.id} />
          ))}
        </div>
      )}
    </div>
  )
}

function ReimbCard({ t }: { t: Transaction }) {
  const c = cat(t.categoryId)
  const r = t.reimb!
  const [secu, setSecu] = useState(centsToInput(r.secu))
  const [mut, setMut] = useState(centsToInput(r.mutuelle))
  const age = daysBetween(t.date, today())
  const rest = t.amount - (r.secuAt ? r.secu : 0) - (r.mutuelleAt ? r.mutuelle : 0)
  return (
    <div class="card">
      <button class="row" style={{ width: '100%', textAlign: 'left' }} onClick={() => openEdit(t)}>
        <Bubble emoji={c.emoji} color={c.color} />
        <div class="grow">
          <b>{t.label || c.name}</b>
          <div class="tiny muted">
            {shortDate(t.date)} · {c.name}
            {age > 21 && (waitingSecu(t) || waitingMut(t)) && <span class="warn bold"> · {age} j</span>}
          </div>
        </div>
        <b class="num">{money(t.amount, { exact: true })}</b>
      </button>
      <div class="col mt" style={{ gap: 8 }}>
        <Line label="🏛️ Sécu" value={secu} setValue={setSecu} at={r.secuAt} expected={r.secu} onDone={() => markReimbursed(t.id, 'secu', parseMoney(secu))} />
        <Line label="💙 Mutuelle" value={mut} setValue={setMut} at={r.mutuelleAt} expected={r.mutuelle} onDone={() => markReimbursed(t.id, 'mutuelle', parseMoney(mut))} />
        <div class="tiny muted">Reste à charge actuel : {money(rest, { exact: true })}</div>
      </div>
    </div>
  )
}

function Line({ label, value, setValue, at, expected, onDone }: { label: string; value: string; setValue: (v: string) => void; at?: string; expected: number; onDone: () => void }) {
  if (at) return <div class="row small"><span class="grow">{label}</span><span class="badge good">✓ {money(expected, { exact: true })} reçu le {shortDate(at)}</span></div>
  if (!expected && !value) return <div class="row small muted"><span class="grow">{label}</span><span>non concerné</span></div>
  return (
    <div class="row small">
      <span class="grow">{label}</span>
      <input class="input" inputMode="decimal" style={{ width: 86, minHeight: 36, padding: '4px 10px', textAlign: 'right' }} value={value} onInput={(e) => setValue(e.currentTarget.value)} />
      <button class="btn sm good" style={{ minHeight: 36 }} onClick={onDone}>
        Reçu ✓
      </button>
    </div>
  )
}
