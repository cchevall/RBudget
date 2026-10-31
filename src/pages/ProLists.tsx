import { useState } from 'preact/hooks'
import { state } from '../store/store'
import type { ProKind } from '../store/types'
import { caBetween, chargesBetween, declarations, declaredOf, declLabel, fmtCur, invoiceEur, isReel, PRO_KINDS, proCSV, remunerations, taxable, taxBox, urssafPaidBetween } from '../lib/pro'
import { FREQ_LABEL, nextOccurrence } from '../lib/recurring'
import { addDays, download, money, pad, shortDate, sum, today } from '../lib/utils'
import { Bubble, Empty, Header } from '../components/ui'
import { MonthBars } from '../components/charts'
import { openEdit } from '../components/AddSheet'
import { openPro } from '../components/ProSheets'

const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const dmy = (d: string) => d.split('-').reverse().join('/')

/** Years with pro data, newest first, always including the current one */
function proYears() {
  const s = state.value
  const ys = new Set([today().slice(0, 4)])
  for (const i of s.pro.invoices) ys.add((i.paidAt ?? i.date).slice(0, 4))
  for (const e of s.pro.expenses) ys.add(e.date.slice(0, 4))
  return [...ys].sort().reverse()
}

function YearChips({ value, onChange }: { value: string; onChange: (y: string) => void }) {
  return (
    <div class="chips">
      {proYears().map((y) => (
        <button class={`chip ${y === value ? 'on' : ''}`} onClick={() => onChange(y)}>
          {y}
        </button>
      ))}
    </div>
  )
}

export function ProInvoices() {
  const s = state.value
  const p = s.pro.settings
  const [year, setYear] = useState(today().slice(0, 4))
  const list = s.pro.invoices.filter((i) => (i.paidAt ?? i.date).startsWith(year)).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))
  const paid = list.filter((i) => i.paidAt?.startsWith(year))
  return (
    <div class="page">
      <Header title="Factures" right={<button class="icon-btn" onClick={() => openPro({ kind: 'invoice' })}>＋</button>} />
      <YearChips value={year} onChange={setYear} />
      <div class="grid2 mt">
        <div class="card" style={{ padding: 14 }}>
          <div class="tiny muted">Encaissé {year}</div>
          <b class="num good">{money(sum(paid.map((i) => i.received ?? 0)), { exact: true })}</b>
        </div>
        <div class="card" style={{ padding: 14 }}>
          <div class="tiny muted">Déclaré {year}</div>
          <b class="num">{money(sum(paid.map(declaredOf)), { exact: true })}</b>
        </div>
      </div>
      <div class="card mt">
        {list.length === 0 ? (
          <Empty emoji="🧾" title="Aucune facture" text="Ajoute tes factures au fil de l'eau : je calcule ton CA, l'URSSAF et les seuils." />
        ) : (
          list.map((i) => (
            <div class="item" key={i.id}>
              <button class="grow" style={{ textAlign: 'left' }} onClick={() => openPro({ kind: 'invoice', edit: i })}>
                <div class="row between">
                  <b class="small">{i.number}</b>
                  <b class="num small">{fmtCur(i.amount, i.currency)}</b>
                </div>
                <div class="row between tiny muted">
                  <span class="ellipsis">
                    {i.client || 'Client'} · {shortDate(i.date)}
                  </span>
                  {i.paidAt ? (
                    <span class="num">
                      {money(i.received ?? 0, { exact: true })}
                      {i.declared !== undefined && ` · décl. ${money(i.declared, { exact: true })}`}
                    </span>
                  ) : (
                    i.currency !== 'EUR' && <span class="num">≈ {money(invoiceEur(i, p))}</span>
                  )}
                </div>
              </button>
              {i.paidAt ? (
                <span class="badge good">✓ {shortDate(i.paidAt)}</span>
              ) : (
                <button class="btn sm good" onClick={() => openPro({ kind: 'paid', invoice: i })}>
                  Payée ✓
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function ProExpenses() {
  const s = state.value
  const [year, setYear] = useState(today().slice(0, 4))
  const from = `${year}-01-01`
  const to = `${year}-12-31`
  type Row = { id: string; date: string; label: string; amount: number; emoji: string; color: string; sub: string; open: () => void }
  const rows: Row[] = [
    ...s.pro.expenses
      .filter((e) => e.date.startsWith(year))
      .map((e) => ({ id: e.id, date: e.date, label: e.label, amount: e.amount, emoji: PRO_KINDS[e.kind].emoji, color: PRO_KINDS[e.kind].color, sub: PRO_KINDS[e.kind].label + (e.recurringId ? ' 🔁' : ''), open: () => openPro({ kind: 'expense', edit: e }) })),
    ...remunerations(s, from, to).map((t) => ({ id: t.id, date: t.date, label: t.label || 'Virement perso', amount: t.amount, emoji: '🏦', color: '#9be3c4', sub: 'Vers ton compte perso', open: () => openEdit(t) })),
  ].sort((a, b) => b.date.localeCompare(a.date))
  const byKind = new Map<ProKind, number>()
  for (const e of s.pro.expenses.filter((x) => x.date.startsWith(year))) byKind.set(e.kind, (byKind.get(e.kind) ?? 0) + e.amount)
  const t = today()

  return (
    <div class="page">
      <Header title="Dépenses pro" right={<button class="icon-btn" onClick={() => openPro({ kind: 'expense' })}>＋</button>} />

      <div class="section" style={{ marginTop: 0 }}>
        <div class="section-title">
          <h2>🔁 Charges fixes</h2>
          <button onClick={() => openPro({ kind: 'recurring' })}>＋ Ajouter</button>
        </div>
        <div class="card">
          {s.pro.recurrings.length === 0 ? (
            <Empty emoji="🏦" title="Banque pro, mutuelle, logiciels…" text="Saisis-les une fois, je les ajoute toute seule à chaque échéance." />
          ) : (
            s.pro.recurrings.map((r) => {
              const k = PRO_KINDS[r.categoryId as ProKind] ?? PRO_KINDS.autre
              const next = nextOccurrence(r, addDays(t, -1))
              return (
                <button class="item" onClick={() => openPro({ kind: 'recurring', edit: r })} style={{ opacity: r.paused ? 0.5 : 1 }}>
                  <Bubble emoji={k.emoji} color={k.color} size="sm" />
                  <div class="grow">
                    <div class="bold small">{r.label}</div>
                    <div class="tiny muted">
                      {FREQ_LABEL[r.frequency]}
                      {next && !r.paused ? ` · prochain ${shortDate(next)}` : ''}
                      {r.paused ? ' · en pause' : ''}
                    </div>
                  </div>
                  <b class="num small">{money(r.amount, { exact: true })}</b>
                </button>
              )
            })
          )}
        </div>
      </div>

      <div class="section">
        <YearChips value={year} onChange={setYear} />
        {byKind.size > 0 && (
          <div class="card mt">
            {[...byKind.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => (
                <div class="item" style={{ cursor: 'default' }}>
                  <Bubble emoji={PRO_KINDS[k].emoji} color={PRO_KINDS[k].color} size="sm" />
                  <span class="grow small">{PRO_KINDS[k].label}</span>
                  <b class="num small">{money(v)}</b>
                </div>
              ))}
          </div>
        )}
        <div class="card mt">
          {rows.length === 0 ? (
            <Empty emoji="💸" title={`Rien en ${year}`} />
          ) : (
            rows.map((r) => (
              <button class="item" onClick={r.open} key={r.id}>
                <Bubble emoji={r.emoji} color={r.color} />
                <div class="grow">
                  <div class="bold ellipsis">{r.label}</div>
                  <div class="small muted ellipsis">
                    {r.sub} · {shortDate(r.date)}
                  </div>
                </div>
                <span class="amount">−{money(r.amount, { exact: true })}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export function ProUrssaf() {
  const s = state.value
  const p = s.pro.settings
  const t = today()
  const decls = declarations(s).reverse()
  const payments = s.pro.expenses.filter((e) => e.kind === 'urssaf').sort((a, b) => b.date.localeCompare(a.date))
  const badge = { open: ['', 'en cours'], due: ['warn', 'à déclarer'], late: ['bad', 'en retard'], paid: ['good', 'payée ✓'] } as const
  return (
    <div class="page">
      <Header title="URSSAF" />
      {isReel(p, t) ? (
        <div class="card soft">
          <b>🔀 Régime réel</b>
          <p class="small muted mt">
            L'URSSAF prélève des acomptes calculés sur tes revenus passés, puis régularise. Ajoute chaque prélèvement en dépense « URSSAF » : je garde de côté ≈ {p.reelRate} % de ton bénéfice et je retire ce qui est déjà payé.
          </p>
          <button class="btn sm block mt" onClick={() => openPro({ kind: 'expense', prefill: { kind: 'urssaf', label: 'URSSAF' } })}>
            ＋ Prélèvement URSSAF
          </button>
        </div>
      ) : (
        <p class="small muted" style={{ margin: '0 4px 12px' }}>
          Déclaration {p.declaration === 'monthly' ? 'mensuelle' : 'trimestrielle'} du CA encaissé, avant la fin du mois suivant. Je prépare le montant, tu n'as qu'à le recopier 📋
        </p>
      )}
      {decls.length > 0 && (
        <div class="card mt">
          {decls.map((d) => (
            <button class="item" onClick={() => openPro({ kind: 'urssaf', decl: d })} key={d.key}>
              <span style={{ fontSize: 22 }}>🏛️</span>
              <div class="grow">
                <div class="bold small">{declLabel(d.key)}</div>
                <div class="tiny muted">
                  CA {money(d.ca, { exact: true })} · avant le {shortDate(d.due)}
                </div>
              </div>
              <div class="col" style={{ alignItems: 'flex-end', gap: 2 }}>
                <b class="num small">{money(d.status === 'paid' ? d.paid : d.estimate, { exact: d.status === 'paid' })}</b>
                <span class={`badge ${badge[d.status][0]}`}>{badge[d.status][1]}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      <div class="section">
        <div class="section-title">
          <h2>💳 Paiements</h2>
        </div>
        <div class="card">
          {payments.length === 0 ? (
            <Empty emoji="🏛️" title="Aucun paiement noté" />
          ) : (
            payments.map((e) => (
              <button class="item" onClick={() => openPro({ kind: 'expense', edit: e })} key={e.id}>
                <span class="grow small">
                  <b>{e.label}</b>
                  <div class="tiny muted">{dmy(e.date)}</div>
                </span>
                <b class="num small">{money(e.amount, { exact: true })}</b>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export function ProYear() {
  const s = state.value
  const p = s.pro.settings
  const [year, setYear] = useState(String(Number(today().slice(0, 4)) - (today() < `${today().slice(0, 4)}-06-10` ? 1 : 0)))
  const from = `${year}-01-01`
  const to = `${year}-12-31`
  const ca = caBetween(s, from, to)
  const received = sum(s.pro.invoices.filter((i) => i.paidAt && i.paidAt >= from && i.paidAt <= to).map((i) => i.received ?? 0))
  const urssaf = urssafPaidBetween(s, from, to)
  const charges = chargesBetween(s, from, to)
  const remu = sum(remunerations(s, from, to).map((t) => t.amount))
  const creche = sum(s.transactions.filter((t) => t.type === 'expense' && t.categoryId === 'enf-creche' && t.date >= from && t.date <= to).map((t) => t.amount))
  const months = Array.from({ length: 12 }, (_, m) => {
    const a = `${year}-${pad(m + 1)}-01`
    const b = `${year}-${pad(m + 1)}-31`
    return { label: MONTHS_SHORT[m].slice(0, 3), income: caBetween(s, a, b), expense: urssafPaidBetween(s, a, b) + chargesBetween(s, a, b), urssaf: urssafPaidBetween(s, a, b), creche: sum(s.transactions.filter((t) => t.type === 'expense' && t.categoryId === 'enf-creche' && t.date >= a && t.date <= b).map((t) => t.amount)) }
  })
  const reel = isReel(p, from)
  const invoices = s.pro.invoices.filter((i) => i.paidAt && i.paidAt >= from && i.paidAt <= to).sort((a, b) => a.paidAt!.localeCompare(b.paidAt!))

  return (
    <div class="page">
      <Header title="Bilan & impôts" />
      <YearChips value={year} onChange={setYear} />

      <div class="card mt">
        <MonthBars data={months} />
        <div class="row center tiny muted mt" style={{ justifyContent: 'center', gap: 14 }}>
          <span>🟢 CA encaissé</span>
          <span>🌸 URSSAF + frais</span>
        </div>
      </div>

      <div class="card mt">
        <Row label="CA déclaré" value={ca} bold />
        {received !== ca && <Row label="Montant reçu sur le compte" value={received} />}
        <Row label="URSSAF payée" value={-urssaf} />
        <Row label="Frais pro" value={-charges} />
        <Row label="Résultat" value={ca - urssaf - charges} bold />
        <Row label="Versé sur ton compte perso" value={remu} />
      </div>

      <div class="section">
        <div class="section-title">
          <h2>📝 Pour ta déclaration (mai {Number(year) + 1})</h2>
        </div>
        <div class="card">
          {reel ? (
            <p class="small">Au réel, le bénéfice vient de la liasse 2035 préparée avec ton comptable. Bénéfice estimé : <b>{money(taxable(s, year))}</b></p>
          ) : (
            <>
              <Row label={`2042-C-PRO · case ${taxBox(p)} (CA brut)`} value={ca} bold />
              <Row label={`Revenu imposable après abattement ${p.abattement} %`} value={taxable(s, year)} />
              {p.vl && <p class="tiny muted mt">Versement libératoire : l'impôt est déjà payé, la case sert au calcul du revenu fiscal de référence.</p>}
            </>
          )}
          {creche > 0 && <Row label="Frais de garde (crèche) · case 7GA" value={creche} bold />}
          <p class="tiny faint mt">Cases indicatives : vérifie toujours sur impots.gouv, elles changent parfois.</p>
        </div>
      </div>

      {invoices.length > 0 && (
        <div class="section">
          <div class="section-title">
            <h2>🧾 Factures encaissées</h2>
          </div>
          <div class="card">
            <div class="row tiny muted bold" style={{ padding: '0 0 6px' }}>
              <span class="grow">Facture</span>
              <span style={{ width: 90, textAlign: 'right' }}>Reçu</span>
              <span style={{ width: 90, textAlign: 'right' }}>Déclaré</span>
            </div>
            {invoices.map((i) => (
              <button class="row small" style={{ width: '100%', padding: '6px 0', borderTop: '1px solid var(--line)' }} onClick={() => openPro({ kind: 'invoice', edit: i })}>
                <span class="grow" style={{ textAlign: 'left' }}>
                  {i.number}
                </span>
                <span class="num" style={{ width: 90, textAlign: 'right' }}>
                  {money(i.received ?? 0, { exact: true })}
                </span>
                <span class="num" style={{ width: 90, textAlign: 'right' }}>
                  {money(declaredOf(i), { exact: true })}
                </span>
              </button>
            ))}
            <div class="row small bold" style={{ padding: '8px 0 0', borderTop: '1.5px solid var(--line)' }}>
              <span class="grow">Total</span>
              <span class="num" style={{ width: 90, textAlign: 'right' }}>
                {money(received, { exact: true })}
              </span>
              <span class="num" style={{ width: 90, textAlign: 'right' }}>
                {money(ca, { exact: true })}
              </span>
            </div>
          </div>
        </div>
      )}

      <div class="section">
        <div class="section-title">
          <h2>📆 Mois par mois</h2>
        </div>
        <div class="card">
          <div class="row tiny muted bold" style={{ padding: '0 0 6px' }}>
            <span class="grow">Mois</span>
            <span style={{ width: 80, textAlign: 'right' }}>CA</span>
            <span style={{ width: 70, textAlign: 'right' }}>URSSAF</span>
            {creche > 0 && <span style={{ width: 70, textAlign: 'right' }}>Crèche</span>}
          </div>
          {months.map((m, i) => (
            <div class="row small" style={{ padding: '5px 0', borderTop: '1px solid var(--line)' }}>
              <span class="grow">{MONTHS_SHORT[i]}</span>
              <span class="num" style={{ width: 80, textAlign: 'right' }}>
                {m.income ? money(m.income) : '–'}
              </span>
              <span class="num" style={{ width: 70, textAlign: 'right' }}>
                {m.urssaf ? money(m.urssaf) : '–'}
              </span>
              {creche > 0 && (
                <span class="num" style={{ width: 70, textAlign: 'right' }}>
                  {m.creche ? money(m.creche) : '–'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <button class="btn ghost block mt-l" onClick={() => download(`mochi-pro-${year}.csv`, '﻿' + proCSV(s, year), 'text/csv')}>
        📤 Exporter {year} en CSV (comptable, Numbers, Excel)
      </button>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div class="item" style={{ cursor: 'default' }}>
      <span class={`grow small ${bold ? 'bold' : ''}`}>{label}</span>
      <span class={`num small ${bold ? 'bold' : ''} ${value < 0 ? 'muted' : ''}`}>{money(value, { exact: true })}</span>
    </div>
  )
}
