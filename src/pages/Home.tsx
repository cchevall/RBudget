import { useState } from 'preact/hooks'
import { cat, confirmPending, goalSaved, noSpendToday, skipPending, state, update, fireConfetti } from '../store/store'
import { forecast, envelopeStatus } from '../lib/stats'
import { challengeState, levelOf, mascotMood, streak, weeklyChallenges, weekRange } from '../lib/game'
import { computeInsights } from '../lib/insights'
import { addDays, centsToInput, currentPeriod, money, parseMoney, periodLabel, shortDate, today, vibrate } from '../lib/utils'
import { Mascot } from '../components/Mascot'
import { Bar, Bubble, CountUp } from '../components/ui'
import { TxRow } from '../components/common'
import { Jar } from '../components/charts'
import { openAdd } from '../components/AddSheet'
import { go } from '../router'
import { ProCard } from './Pro'

export function Home() {
  const s = state.value
  const p = currentPeriod()
  const f = forecast(s, p)
  const { mood, line } = mascotMood(s)
  const lvl = levelOf(s.game.xp)
  const str = streak(s.game.checkins)
  const checkedToday = s.game.checkins.includes(today())
  const recent = [...s.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 5)
  const envs = s.envelopes.map((e) => envelopeStatus(s, e, p)).sort((a, b) => b.ratio - a.ratio).slice(0, 4)
  const goals = s.goals.filter((g) => !g.archived && !g.doneAt).slice(0, 4)
  const alerts = computeInsights(s).filter((i) => i.level === 'alert' || i.level === 'warn')
  const hour = new Date().getHours()
  const hello = hour < 5 ? 'Bonne nuit' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Coucou' : 'Bonsoir'

  return (
    <div class="page">
      {/* Mascot + greeting */}
      <div class="row" style={{ gap: 14, marginBottom: 12 }}>
        <Mascot mood={mood} size={92} crown={lvl.level >= 10} onClick={() => (vibrate(15), go('/trophies'))} />
        <div class="grow col gap-s">
          <div class="row between">
            <h1 style={{ fontSize: 22 }}>
              {hello}
              {s.settings.name ? ` ${s.settings.name}` : ''} !
            </h1>
          </div>
          <div class="speech small">{line}</div>
        </div>
      </div>
      <div class="row gap-s" style={{ marginBottom: 14 }}>
        <button class="chip" onClick={() => go('/trophies')}>
          ⭐ Niv. {lvl.level} · {lvl.name}
        </button>
        <button class="chip" onClick={() => go('/trophies')}>
          <span class={str ? 'streak-flame' : ''} style={{ fontSize: 16 }}>
            🔥
          </span>
          {str} j
        </button>
      </div>

      <div class="stagger">
        {/* Hero */}
        <div class="hero" onClick={() => go('/stats')}>
          <div class="small" style={{ opacity: 0.9 }}>
            Reste à vivre · {periodLabel(p)}
          </div>
          <div class="big">
            <CountUp value={f.endBalance} />
          </div>
          <div class="small" style={{ opacity: 0.95, marginTop: 2 }}>
            {f.income === 0 && f.upcomingIncome === 0 ? 'Ajoute tes revenus pour voir ton reste à vivre ✨' : f.endBalance >= 0 ? `≈ ${money(Math.round(f.perDay))} par jour pendant ${f.days} jour${f.days > 1 ? 's' : ''} 🍡` : 'Attention, fin de mois serrée 🌧️'}
          </div>
          <div class="row mt" style={{ gap: 8 }}>
            <div class="pill">
              <span>Revenus</span>
              <b>{money(f.income)}</b>
            </div>
            <div class="pill">
              <span>Dépensé</span>
              <b>{money(f.expense)}</b>
            </div>
            <div class="pill">
              <span>À venir</span>
              <b>{money(f.upcomingExpense - f.upcomingIncome)}</b>
            </div>
          </div>
        </div>

        {s.settings.profile === 'ae' && <ProCard />}

        {/* Daily check-in */}
        {!checkedToday && (
          <div class="card mt" style={{ background: 'var(--accent-soft)', borderColor: 'transparent' }}>
            <div class="bold">Le check du jour 🌼</div>
            <p class="small muted">Une dépense aujourd'hui ? Sinon déclare une journée zen pour garder ta série !</p>
            <div class="row mt">
              <button class="btn sm grow" onClick={() => openAdd()}>
                ➕ J'ajoute
              </button>
              <button class="btn sm white grow" onClick={noSpendToday}>
                🧘 Rien dépensé
              </button>
            </div>
          </div>
        )}

        <WeekStrip />

        {/* Pending recurring */}
        {s.pending.length > 0 && <PendingCard />}

        {/* Alerts */}
        {alerts.length > 0 && (
          <div class="card tap mt" onClick={() => go('/coach')} style={{ background: 'var(--warn-soft)', borderColor: 'transparent' }}>
            <div class="row">
              <span style={{ fontSize: 28 }} class="float">
                🕵️
              </span>
              <div class="grow">
                <div class="bold">
                  {alerts.length} truc{alerts.length > 1 ? 's' : ''} à vérifier
                </div>
                <div class="small muted ellipsis">{alerts[0].title} · {alerts[0].text}</div>
              </div>
              <span>›</span>
            </div>
          </div>
        )}

        {/* Envelopes */}
        <div class="section">
          <div class="section-title">
            <h2>✉️ Enveloppes</h2>
            <a href="#/envelopes">Tout voir</a>
          </div>
          {envs.length ? (
            <div class="card">
              {envs.map((st) => {
                const c = cat(st.envelope.categoryId)
                const total = st.budget + st.carry
                return (
                  <div class="item" style={{ cursor: 'default' }} onClick={() => go('/envelopes')}>
                    <Bubble emoji={c.emoji} color={c.color} size="sm" />
                    <div class="grow col gap-s">
                      <div class="row between small">
                        <b>{c.name}</b>
                        <span class={st.left < 0 ? 'bad bold' : 'muted'}>{st.left < 0 ? `−${money(-st.left)}` : `${money(st.left)} restants`}</span>
                      </div>
                      <Bar value={total ? st.spent / total : 0} kind="thin" color={st.left < 0 ? 'var(--bad)' : st.ratio > 0.85 ? 'var(--warn)' : c.color} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <button class="card tap" style={{ width: '100%', textAlign: 'left' }} onClick={() => go('/envelopes')}>
              <div class="row">
                <span style={{ fontSize: 30 }}>✉️</span>
                <div>
                  <div class="bold">Crée tes enveloppes</div>
                  <div class="small muted">Je peux te les proposer à partir de tes dépenses !</div>
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Goals */}
        <div class="section">
          <div class="section-title">
            <h2>🎯 Objectifs & projets</h2>
            <a href="#/projects">Tout voir</a>
          </div>
          {goals.length ? (
            <div class="chips" style={{ gap: 12, paddingBottom: 10 }}>
              {goals.map((g) => {
                const saved = goalSaved(g)
                return (
                  <button class="card tap" style={{ minWidth: 140, textAlign: 'center', padding: 12 }} onClick={() => go(`/goal/${g.id}`)}>
                    <Jar value={saved / g.target} color={g.color} size={70} emoji={g.emoji} />
                    <div class="bold small ellipsis">{g.name}</div>
                    <div class="tiny muted">
                      {money(saved)} / {money(g.target)}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <button class="card tap" style={{ width: '100%', textAlign: 'left' }} onClick={() => go('/projects')}>
              <div class="row">
                <span style={{ fontSize: 30 }}>🏖️</span>
                <div>
                  <div class="bold">Un rêve à financer ?</div>
                  <div class="small muted">Vacances, Noël, voiture… crée une jauge et remplis-la !</div>
                </div>
              </div>
            </button>
          )}
        </div>

        <Challenges />

        {/* Upcoming */}
        {f.upcoming.length > 0 && (
          <div class="section">
            <div class="section-title">
              <h2>📅 À venir ce mois-ci</h2>
              <a href="#/recurring">Gérer</a>
            </div>
            <div class="card">
              {f.upcoming.slice(0, 5).map((u) => (
                <div class="item">
                  <Bubble emoji={cat(u.categoryId).emoji} color={cat(u.categoryId).color} size="sm" />
                  <div class="grow">
                    <div class="bold small">{u.label}</div>
                    <div class="tiny muted">{shortDate(u.date)}</div>
                  </div>
                  <span class={`amount small ${u.type === 'income' ? 'in' : ''}`}>
                    {u.type === 'income' ? '+' : '−'}
                    {money(u.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent */}
        <div class="section">
          <div class="section-title">
            <h2>🧾 Dernières opérations</h2>
            <a href="#/tx">Tout voir</a>
          </div>
          <div class="card">
            {recent.length ? (
              <div class="list">
                {recent.map((t) => (
                  <TxRow t={t} showDate key={t.id} />
                ))}
              </div>
            ) : (
              <div class="empty">
                <span class="big">🐣</span>
                Rien pour l'instant. Appuie sur le gros <b>+</b> !
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function WeekStrip() {
  const s = state.value
  const [start] = weekRange()
  const names = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
  return (
    <div class="card mt" style={{ padding: '12px 14px' }}>
      <div class="week">
        {names.map((n, i) => {
          const d = addDays(start, i)
          const on = s.game.checkins.includes(d)
          const ns = s.game.noSpendDays.includes(d)
          return (
            <div class={`d ${on ? 'on' : ''} ${ns ? 'ns' : ''} ${d === today() ? 'today' : ''}`}>
              <i>{ns ? '🧘' : on ? '✓' : d > today() ? '' : '·'}</i>
              {n}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PendingCard() {
  const s = state.value
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  return (
    <div class="section">
      <div class="section-title">
        <h2>🔔 À confirmer</h2>
      </div>
      <div class="card">
        {s.pending.map((p) => {
          const r = s.recurrings.find((x) => x.id === p.recurringId)
          if (!r) return null
          const c = cat(r.categoryId)
          const v = amounts[p.id] ?? centsToInput(r.amount)
          return (
            <div class="item" key={p.id}>
              <Bubble emoji={c.emoji} color={c.color} size="sm" />
              <div class="grow">
                <div class="bold small">{r.label}</div>
                <div class="tiny muted">{shortDate(p.date)}</div>
              </div>
              <input class="input" inputMode="decimal" style={{ width: 88, minHeight: 38, padding: '6px 10px', textAlign: 'right' }} value={v} onInput={(e) => setAmounts({ ...amounts, [p.id]: e.currentTarget.value })} />
              <button class="icon-btn" style={{ background: 'var(--good-soft)', color: 'var(--good)' }} onClick={() => (vibrate(), confirmPending(p.id, parseMoney(v)))} aria-label="Confirmer">
                ✓
              </button>
              <button class="icon-btn" style={{ background: 'var(--line)', color: 'var(--ink-soft)' }} onClick={() => skipPending(p.id)} aria-label="Ignorer">
                ✕
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Challenges() {
  const s = state.value
  const list = weeklyChallenges()
  return (
    <div class="section">
      <div class="section-title">
        <h2>🏁 Défis de la semaine</h2>
      </div>
      <div class="col">
        {list.map((c) => {
          const st = challengeState(s, c)
          const fmt = (n: number) => (c.unit === 'money' ? money(n) : String(n))
          return (
            <div class="card" style={{ padding: 14, opacity: st.claimed ? 0.6 : 1 }}>
              <div class="row">
                <span style={{ fontSize: 30 }}>{c.emoji}</span>
                <div class="grow">
                  <div class="row between">
                    <b>{c.title}</b>
                    <span class="badge">+{c.xp} XP</span>
                  </div>
                  <div class="small muted">{c.desc}</div>
                  <div class="row mt" style={{ gap: 8 }}>
                    <div class="grow">
                      <Bar value={st.progress} kind="thin" color={st.failed ? 'var(--bad)' : undefined} />
                    </div>
                    <span class="tiny muted num">
                      {fmt(st.value)} {c.kind === 'atLeast' ? `/ ${fmt(c.target)}` : `(max ${fmt(c.target)})`}
                    </span>
                  </div>
                </div>
              </div>
              {st.claimable && (
                <button
                  class="btn good block mt"
                  onClick={() => {
                    update((x) => {
                      x.game.claimedChallenges.push(c.key)
                      x.game.xp += c.xp
                    })
                    fireConfetti()
                  }}
                >
                  Récupérer ma récompense 🎁
                </button>
              )}
              {st.claimed && <div class="small good bold mt">✓ Défi réussi !</div>}
              {c.kind === 'atMost' && !st.claimed && !st.failed && !st.claimable && <div class="tiny muted mt">Récompense dimanche si tu tiens bon 💪</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
