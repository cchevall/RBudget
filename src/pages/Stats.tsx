import { useState } from 'preact/hooks'
import { cat, state } from '../store/store'
import { averageByTop, history, spentByTop, totals, txOfPeriod } from '../lib/stats'
import { monthlyEquivalent } from '../lib/recurring'
import { currentPeriod, daysBetween, money, periodLabel, periodRange, today } from '../lib/utils'
import { Bubble, Empty, Header } from '../components/ui'
import { PeriodSwitch } from '../components/common'
import { Donut, MonthBars } from '../components/charts'
import { go } from '../router'

export function Stats() {
  const s = state.value
  const [period, setPeriod] = useState(currentPeriod())
  const [picked, setPicked] = useState<string | null>(null)
  const t = totals(s, period)
  const tops = spentByTop(s, period)
  const total = tops.reduce((a, [, v]) => a + v, 0)
  const avg = averageByTop(s, 3)
  const hist = history(s, 6, period)
  const [a, b] = periodRange(period)
  const days = Math.max(1, daysBetween(a, today() < b ? today() : b) + 1)
  const fixed = s.recurrings.filter((r) => r.type === 'expense' && !r.paused).reduce((x, r) => x + monthlyEquivalent(r), 0)

  // Biggest labels
  const labels = new Map<string, { n: number; v: number; c: string }>()
  for (const x of txOfPeriod(s, period)) {
    if (x.type !== 'expense') continue
    const k = x.label || cat(x.categoryId).name
    const e = labels.get(k) ?? { n: 0, v: 0, c: x.categoryId }
    e.n++
    e.v += x.amount
    labels.set(k, e)
  }
  const topLabels = [...labels.entries()].sort((x, y) => y[1].v - x[1].v).slice(0, 5)
  const p = picked ? tops.find(([id]) => id === picked) : null

  return (
    <div class="page">
      <Header title="Statistiques" />
      <PeriodSwitch value={period} onChange={setPeriod} />

      <div class="grid2 mt">
        <div class="card" style={{ padding: 14 }}>
          <div class="tiny muted">Revenus</div>
          <b class="num good" style={{ fontSize: 20 }}>
            {money(t.income)}
          </b>
        </div>
        <div class="card" style={{ padding: 14 }}>
          <div class="tiny muted">Dépenses</div>
          <b class="num" style={{ fontSize: 20 }}>
            {money(t.expense)}
          </b>
        </div>
        <div class="card" style={{ padding: 14 }}>
          <div class="tiny muted">Taux d'épargne</div>
          <b class={`num ${t.savingsRate >= 0.1 ? 'good' : t.savingsRate < 0 ? 'bad' : ''}`} style={{ fontSize: 20 }}>
            {t.income ? `${Math.round(t.savingsRate * 100)}%` : '–'}
          </b>
        </div>
        <div class="card" style={{ padding: 14 }}>
          <div class="tiny muted">Par jour</div>
          <b class="num" style={{ fontSize: 20 }}>
            {money(Math.round(t.expense / days))}
          </b>
        </div>
      </div>

      <div class="card mt center">
        <h3 style={{ textAlign: 'left' }}>Où part l'argent ?</h3>
        {tops.length === 0 ? (
          <Empty emoji="🍩" title="Pas encore de dépenses ce mois-ci" />
        ) : (
          <>
            <div style={{ display: 'grid', placeItems: 'center', marginTop: 12 }}>
              <Donut key={period} data={tops.map(([id, v]) => ({ id, value: v, color: cat(id).color }))} onPick={(id) => setPicked(picked === id ? null : id)}>
                {p ? (
                  <>
                    <div style={{ fontSize: 28 }}>{cat(p[0]).emoji}</div>
                    <b>{money(p[1])}</b>
                    <div class="tiny muted">{Math.round((p[1] / total) * 100)}%</div>
                  </>
                ) : (
                  <>
                    <div class="tiny muted">Total</div>
                    <b style={{ fontSize: 20 }}>{money(total)}</b>
                  </>
                )}
              </Donut>
            </div>
            <div class="list mt" style={{ textAlign: 'left' }}>
              {tops.map(([id, v]) => {
                const av = avg.get(id)
                const diff = av ? (v - av) / av : 0
                return (
                  <button class="item" onClick={() => go(`/tx?cat=${id}`)}>
                    <Bubble emoji={cat(id).emoji} color={cat(id).color} size="sm" />
                    <div class="grow">
                      <div class="bold small">{cat(id).name}</div>
                      <div class="tiny muted">
                        {Math.round((v / total) * 100)}%
                        {av ? ` · moy. ${money(Math.round(av))}` : ''}
                      </div>
                    </div>
                    <div class="col" style={{ alignItems: 'flex-end', gap: 2 }}>
                      <b class="num small">{money(v)}</b>
                      {av && Math.abs(diff) > 0.15 ? <span class={`badge ${diff > 0 ? 'bad' : 'good'}`}>{diff > 0 ? '▲' : '▼'} {Math.round(Math.abs(diff) * 100)}%</span> : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div class="card mt">
        <div class="row between">
          <h3>6 derniers mois</h3>
          <div class="row tiny muted gap-s">
            <span style={{ color: 'var(--good)' }}>●</span> revenus <span style={{ color: 'var(--accent)' }}>●</span> dépenses
          </div>
        </div>
        <MonthBars data={hist.map((h) => ({ label: periodLabel(h.period, true).slice(0, 4), income: h.income, expense: h.expense }))} />
        <div class="list mt">
          {hist
            .slice()
            .reverse()
            .map((h) => (
              <div class="row between small" style={{ padding: '5px 2px' }}>
                <span>{periodLabel(h.period)}</span>
                <b class={`num ${h.net >= 0 ? 'good' : 'bad'}`}>{money(h.net, { sign: true })}</b>
              </div>
            ))}
        </div>
      </div>

      {topLabels.length > 0 && (
        <div class="card mt">
          <h3>Top dépenses par libellé</h3>
          {topLabels.map(([k, v]) => (
            <div class="item">
              <Bubble emoji={cat(v.c).emoji} color={cat(v.c).color} size="sm" />
              <span class="grow small bold ellipsis">{k}</span>
              <span class="tiny muted">{v.n}×</span>
              <b class="num small">{money(v.v)}</b>
            </div>
          ))}
        </div>
      )}

      {fixed > 0 && (
        <div class="card soft mt">
          <div class="row between">
            <span>🔁 Charges fixes mensuelles</span>
            <b class="num">{money(Math.round(fixed))}</b>
          </div>
          {t.income > 0 && <div class="small muted mt">Soit {Math.round((fixed / t.income) * 100)}% de tes revenus du mois</div>}
        </div>
      )}
    </div>
  )
}
