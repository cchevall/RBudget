import { state } from '../store/store'
import { declLabel, deadlines, fmtCur, invoiceEur, isReel, microRate, proSummary, REMU, smoothed, taxable, taxBox, yearCA } from '../lib/pro'
import { monthlyEquivalent } from '../lib/recurring'
import { daysBetween, money, shortDate, today, vibrate } from '../lib/utils'
import { Bar, CountUp, Header } from '../components/ui'
import { openAdd } from '../components/AddSheet'
import { openPro } from '../components/ProSheets'
import { go } from '../router'

/** Rounded down to 10 €, what is safe to transfer to the personal account */
const safeTransfer = (available: number) => Math.max(0, Math.floor(available / 1000) * 1000)

export const payMyself = (available: number) => openAdd({ type: 'income', categoryId: REMU, label: 'Virement pro', amount: safeTransfer(available) || undefined })

export function ProHome() {
  const s = state.value
  const p = s.pro.settings
  const sum = proSummary(s)
  const t = today()
  const year = t.slice(0, 4)
  const monthCA = s.pro.invoices.filter((i) => i.paidAt?.startsWith(t.slice(0, 7))).reduce((a, i) => a + (i.declared ?? i.received ?? 0), 0)
  const smooth = smoothed(s)
  const remuRec = s.recurrings.filter((r) => r.categoryId === REMU && !r.paused).reduce((a, r) => a + monthlyEquivalent(r), 0)
  const caYear = yearCA(s, year)
  const caPrev = yearCA(s, Number(year) - 1)
  const reel = isReel(p, t)
  const cal = deadlines(s).slice(0, 6)
  const urgent = [...sum.late, ...(sum.next && sum.next.status === 'due' ? [sum.next] : [])]

  return (
    <div class="page">
      <Header title="Mon activité" back={false} right={<button class="icon-btn" onClick={() => go('/pro/settings')} aria-label="Réglages pro">⚙️</button>} />

      <div class="stagger">
        <div class="hero" onClick={() => go('/pro/year')}>
          <div class="small" style={{ opacity: 0.9 }}>
            Tu peux te verser
          </div>
          <div class="big">
            <CountUp value={Math.max(0, sum.available)} />
          </div>
          <div class="small" style={{ opacity: 0.95, marginTop: 2 }}>
            {sum.available < 0 ? `Il manque ${money(-sum.available)} pour couvrir ce qui est dû 🌧️` : `Trésorerie ${p.bank || 'pro'} ${money(sum.cash)} · ${money(sum.reserved)} mis de côté`}
          </div>
          <div class="row mt" style={{ gap: 8 }}>
            <div class="pill">
              <span>CA du mois</span>
              <b>{money(monthCA)}</b>
            </div>
            <div class="pill">
              <span>URSSAF dû</span>
              <b>{money(sum.urssaf)}</b>
            </div>
            <div class="pill">
              <span>À encaisser</span>
              <b>{money(sum.pendingIn)}</b>
            </div>
          </div>
        </div>

        <div class="row mt gap-s">
          <button class="btn sm grow" onClick={() => (vibrate(), openPro({ kind: 'invoice' }))}>
            🧾 Facture
          </button>
          <button class="btn sm ghost grow" onClick={() => (vibrate(), openPro({ kind: 'expense' }))}>
            💸 Frais pro
          </button>
          <button class="btn sm ghost grow" onClick={() => (vibrate(), payMyself(sum.available))}>
            🏦 Me verser
          </button>
        </div>

        {urgent.map((d) => (
          <div class="card mt" style={{ background: d.status === 'late' ? 'var(--bad-soft)' : 'var(--warn-soft)', borderColor: 'transparent' }} key={d.key}>
            <div class="row">
              <span style={{ fontSize: 28 }} class="float">
                🏛️
              </span>
              <div class="grow">
                <b>URSSAF {declLabel(d.key)}</b>
                <div class="small muted">
                  {d.status === 'late' ? 'En retard ! ' : `Avant le ${shortDate(d.due)} · `}CA {money(d.ca, { exact: true })} → ≈ {money(d.estimate)}
                </div>
              </div>
            </div>
            <button class="btn sm block mt" onClick={() => openPro({ kind: 'urssaf', decl: d })}>
              Déclarer maintenant
            </button>
          </div>
        ))}

        {sum.unpaid.length > 0 && (
          <div class="section">
            <div class="section-title">
              <h2>⏳ En attente de paiement</h2>
              <a href="#/pro/invoices">Toutes</a>
            </div>
            <div class="card">
              {sum.unpaid.map((i) => {
                const age = daysBetween(i.date, t)
                return (
                  <div class="item" key={i.id}>
                    <button class="grow" style={{ textAlign: 'left' }} onClick={() => openPro({ kind: 'invoice', edit: i })}>
                      <div class="bold small">
                        {i.number} · {fmtCur(i.amount, i.currency)}
                      </div>
                      <div class={`tiny ${age > 30 ? 'warn bold' : 'muted'}`}>
                        {i.client || 'Client'} · émise il y a {age} j{i.currency !== 'EUR' ? ` · ≈ ${money(invoiceEur(i, p))}` : ''}
                      </div>
                    </button>
                    <button class="btn sm good" onClick={() => openPro({ kind: 'paid', invoice: i })}>
                      Payée ✓
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div class="section">
          <div class="section-title">
            <h2>🐷 Mis de côté pour toi</h2>
          </div>
          <div class="card">
            <Line emoji="🏛️" label={reel ? `URSSAF (≈ ${p.reelRate} % du bénéfice)` : `URSSAF non payée (${microRate(p).toFixed(1).replace('.', ',')} % du CA)`} value={sum.urssaf} />
            {p.cfe > 0 && <Line emoji="🏢" label="CFE de l'année" value={sum.cfe} hint={sum.cfe ? undefined : 'payée ✓'} />}
            <Line emoji="🔁" label="Charges fixes des 30 prochains jours" value={sum.upcoming} />
            {p.cushion > 0 && <Line emoji="🛟" label="Coussin de sécurité" value={p.cushion} />}
            <div class="item" style={{ cursor: 'default' }}>
              <b class="grow">Total</b>
              <b class="num">{money(sum.reserved)}</b>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">
            <h2>📅 Échéancier</h2>
          </div>
          <div class="card">
            {cal.map((d) => (
              <div class="item" style={{ cursor: 'default' }}>
                <span style={{ fontSize: 22 }}>{d.emoji}</span>
                <div class="grow">
                  <div class="bold small">{d.title}</div>
                  <div class="tiny muted">
                    <span class={d.level === 'bad' ? 'bad bold' : d.level === 'warn' ? 'warn bold' : ''}>{d.date < t ? 'dépassé · ' : ''}{shortDate(d.date)}</span>
                    {d.text ? ` · ${d.text}` : ''}
                  </div>
                </div>
                {d.amount !== undefined && <b class="num small">{money(d.amount)}</b>}
              </div>
            ))}
          </div>
        </div>

        <div class="section">
          <div class="section-title">
            <h2>📈 En moyenne par mois</h2>
          </div>
          <div class="card">
            <Line emoji="💶" label="Chiffre d'affaires" value={smooth.ca} />
            <Line emoji="🏛️" label="Cotisations estimées" value={-smooth.cotis} />
            <Line emoji="💼" label="Frais pro" value={-smooth.charges} />
            <div class="item" style={{ cursor: 'default' }}>
              <b class="grow">Rémunération soutenable</b>
              <b class="num good">{money(smooth.net)}</b>
            </div>
            {remuRec > 0 && (
              <p class={`tiny mt ${remuRec > smooth.net ? 'warn bold' : 'muted'}`}>
                Tu te verses ≈ {money(Math.round(remuRec))}/mois en récurrent{remuRec > smooth.net ? ' : un peu plus que ce que l’activité dégage 👀' : ' ✓'}
              </p>
            )}
            <p class="tiny faint mt">Calculé sur {smooth.months < 11.5 ? `${Math.max(1, Math.round(smooth.months))} mois` : '12 mois'} d'encaissements.</p>
          </div>
        </div>

        <div class="section">
          <div class="section-title">
            <h2>🚦 Seuils {year}</h2>
          </div>
          <div class="card col">
            <div>
              <div class="row between small">
                <b>Plafond micro</b>
                <span class="muted num">
                  {money(caYear)} / {money(p.ceiling)}
                </span>
              </div>
              <Bar value={caYear / p.ceiling} kind="thin" color={caYear > p.ceiling ? 'var(--bad)' : caYear > p.ceiling * 0.85 ? 'var(--warn)' : undefined} />
              {caYear > p.ceiling && (
                <p class="tiny warn mt">
                  Plafond dépassé cette année{caPrev > p.ceiling ? ` et en ${Number(year) - 1} : passage au réel le 1er janvier ${Number(year) + 1}.` : '. Si ça se reproduit l’an prochain, tu passeras au réel.'}
                </p>
              )}
            </div>
            {!p.foreignClients && (
              <div>
                <div class="row between small">
                  <b>Franchise de TVA</b>
                  <span class="muted num">
                    {money(caYear)} / {money(p.tvaThreshold)}
                  </span>
                </div>
                <Bar value={caYear / p.tvaThreshold} kind="thin" color={caYear > p.tvaThreshold ? 'var(--bad)' : caYear > p.tvaThreshold * 0.85 ? 'var(--warn)' : undefined} />
              </div>
            )}
            <div class="tiny muted">
              {reel ? '🔀 Régime réel' : `🌱 Micro-entreprise${p.reelFrom ? ` jusqu'au ${p.reelFrom.split('-').reverse().join('/')}` : ''}`}
              {p.foreignClients && ' · clients hors UE : pas de TVA française'}
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">
            <h2>🧾 Impôt sur le revenu {year}</h2>
          </div>
          <div class="card">
            <Line emoji="📄" label={reel ? 'Bénéfice imposable estimé' : `Revenu imposable (CA − ${p.abattement} %)`} value={taxable(s, year)} />
            {p.vl ? (
              <p class="tiny muted mt">Versement libératoire : ton impôt est déjà payé avec l'URSSAF ✓ (à reporter quand même en case {taxBox(p)}).</p>
            ) : p.pasRate > 0 ? (
              <>
                <Line emoji="🏦" label={`Impôt estimé (taux PAS ${p.pasRate} %)`} value={Math.round((taxable(s, year) * p.pasRate) / 100)} />
                <p class="tiny muted mt">Compare avec tes acomptes de prélèvement à la source : si c'est bien plus haut, ajuste-les sur impots.gouv pour éviter une grosse régularisation.</p>
              </>
            ) : (
              <p class="tiny muted mt">Indique ton taux de prélèvement à la source dans les réglages pro pour estimer l'impôt.</p>
            )}
          </div>
        </div>

        <div class="tiles mt-l">
          <button class="tile" onClick={() => go('/pro/invoices')}>
            <span class="e">🧾</span>
            <span>Factures</span>
          </button>
          <button class="tile" onClick={() => go('/pro/expenses')}>
            <span class="e">💸</span>
            <span>Dépenses & charges</span>
          </button>
          <button class="tile" onClick={() => go('/pro/year')}>
            <span class="e">📊</span>
            <span>Bilan & impôts</span>
          </button>
          <button class="tile" onClick={() => go('/pro/urssaf')}>
            <span class="e">🏛️</span>
            <span>URSSAF</span>
          </button>
          <button class="tile" onClick={() => go('/immo')}>
            <span class="e">🏡</span>
            <span>Projet immo</span>
          </button>
          <button class="tile" onClick={() => go('/pro/settings')}>
            <span class="e">⚙️</span>
            <span>Réglages pro</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function Line({ emoji, label, value, hint }: { emoji: string; label: string; value: number; hint?: string }) {
  return (
    <div class="item" style={{ cursor: 'default' }}>
      <span style={{ fontSize: 20 }}>{emoji}</span>
      <span class="grow small">{label}</span>
      <span class="num small bold">{hint ?? money(value)}</span>
    </div>
  )
}

/** Compact summary for the home page */
export function ProCard() {
  const s = state.value
  const sum = proSummary(s)
  const next = sum.next
  return (
    <div class="card tap mt" onClick={() => go('/pro')}>
      <div class="row">
        <span style={{ fontSize: 30 }}>💼</span>
        <div class="grow">
          <div class="row between">
            <b>Mon activité</b>
            <span class={`num bold ${sum.available < 0 ? 'bad' : 'good'}`}>{money(Math.max(0, sum.available))}</span>
          </div>
          <div class="tiny muted">
            à te verser · trésorerie {money(sum.cash)}
            {next && ` · URSSAF ${declLabel(next.key)} ≈ ${money(next.estimate)} avant le ${shortDate(next.due)}`}
          </div>
        </div>
        <span>›</span>
      </div>
      {(sum.unpaid.length > 0 || sum.late.length > 0) && (
        <div class="row gap-s mt wrap">
          {sum.late.length > 0 && <span class="badge bad">🏛️ {sum.late.length} déclaration{sum.late.length > 1 ? 's' : ''} en retard</span>}
          {sum.unpaid.length > 0 && <span class="badge warn">⏳ {sum.unpaid.length} facture{sum.unpaid.length > 1 ? 's' : ''} à encaisser</span>}
        </div>
      )}
    </div>
  )
}
