import { useMemo, useState } from 'preact/hooks'
import { cat, state } from '../store/store'
import { route } from '../router'
import { subtree, totals } from '../lib/stats'
import { currentPeriod, money, normalize, periodRange, prettyDate } from '../lib/utils'
import { PeriodSwitch, TxRow } from '../components/common'
import { Empty, Header } from '../components/ui'
import { openAdd } from '../components/AddSheet'

export function Transactions() {
  const s = state.value
  const q0 = route.value.query
  const [period, setPeriod] = useState(currentPeriod())
  const [q, setQ] = useState(q0.get('q') ?? '')
  const [type, setType] = useState<'all' | 'expense' | 'income'>('all')
  const [catId, setCatId] = useState(q0.get('cat') ?? '')
  const [allTime, setAllTime] = useState(!!q0.get('q'))

  const list = useMemo(() => {
    const [a, b] = periodRange(period)
    const n = normalize(q)
    const ids = catId ? subtree(s, catId) : null
    return s.transactions
      .filter((t) => (allTime || (t.date >= a && t.date <= b)) && (type === 'all' || t.type === type) && (!ids || ids.has(t.categoryId)) && (!n || normalize(`${t.label} ${t.note ?? ''} ${cat(t.categoryId).name}`).includes(n) || (t.amount / 100).toFixed(2).includes(q.replace(',', '.'))))
      .sort((x, y) => y.date.localeCompare(x.date) || y.createdAt - x.createdAt)
  }, [s.transactions, period, q, type, catId, allTime])

  const groups = useMemo(() => {
    const m = new Map<string, typeof list>()
    for (const t of list) m.set(t.date, [...(m.get(t.date) ?? []), t])
    return [...m.entries()]
  }, [list])

  const t = totals(s, period)
  const shownExpense = list.filter((x) => x.type === 'expense').reduce((a, x) => a + x.amount, 0)
  const shownIncome = list.filter((x) => x.type === 'income').reduce((a, x) => a + x.amount, 0)
  const usedTops = [...new Set(s.transactions.map((x) => cat(x.categoryId).parentId ?? x.categoryId))]

  return (
    <div class="page">
      <Header title="Opérations" back={false} right={<button class="icon-btn" onClick={() => openAdd()}>＋</button>} />
      {!allTime && <PeriodSwitch value={period} onChange={setPeriod} />}
      <input class="input mt" type="search" placeholder="🔍 Rechercher un libellé, une note, un montant…" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
      <div class="chips mt">
        <button class={`chip ${allTime ? 'on' : ''}`} onClick={() => setAllTime(!allTime)}>
          🗓️ Tout l'historique
        </button>
        {(['all', 'expense', 'income'] as const).map((k) => (
          <button class={`chip ${type === k ? 'on' : ''}`} onClick={() => setType(k)}>
            {k === 'all' ? 'Tout' : k === 'expense' ? 'Dépenses' : 'Revenus'}
          </button>
        ))}
      </div>
      <div class="chips">
        {catId && (
          <button class="chip on" onClick={() => setCatId('')}>
            {cat(catId).emoji} {cat(catId).name} ✕
          </button>
        )}
        {!catId &&
          usedTops.map((id) => (
            <button class="chip" onClick={() => setCatId(id)}>
              {cat(id).emoji} {cat(id).name}
            </button>
          ))}
      </div>

      <div class="row mt" style={{ gap: 10 }}>
        <div class="card grow" style={{ padding: 12 }}>
          <div class="tiny muted">Dépenses</div>
          <b class="num">{money(q || catId || type !== 'all' || allTime ? shownExpense : t.expense)}</b>
        </div>
        <div class="card grow" style={{ padding: 12 }}>
          <div class="tiny muted">Revenus</div>
          <b class="num good">{money(q || catId || type !== 'all' || allTime ? shownIncome : t.income)}</b>
        </div>
      </div>

      {groups.length === 0 ? (
        <Empty emoji="🍃" title="Aucune opération" text="Rien par ici pour ce filtre." />
      ) : (
        groups.map(([date, items]) => {
          const dayTotal = items.reduce((a, x) => a + (x.type === 'expense' ? -x.amount : x.amount), 0)
          return (
            <div key={date}>
              <div class="day-label">
                <span>{prettyDate(date)}</span>
                <span class="num">{money(dayTotal, { sign: true, exact: true })}</span>
              </div>
              <div class="card" style={{ padding: '4px 14px' }}>
                {items.map((x) => (
                  <TxRow t={x} key={x.id} />
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
