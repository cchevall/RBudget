import { signal } from '@preact/signals'
import { useState } from 'preact/hooks'
import { deleteInvoice, deleteProExpense, deleteProRecurring, markInvoicePaid, saveInvoice, saveProExpense, saveProRecurring, setPro, state, toast } from '../store/store'
import type { Frequency, Invoice, ProExpense, ProKind, Recurring } from '../store/types'
import { declLabel, fmtCur, invoiceEur, nextInvoiceNumber, PRO_KINDS, type Declaration } from '../lib/pro'
import { FREQ_LABEL } from '../lib/recurring'
import { addDays, centsToInput, money, parseMoney, today, vibrate } from '../lib/utils'
import { Bubble, ConfirmButton, Sheet, ToggleRow } from './ui'

export type ProSheetState =
  | { kind: 'invoice'; edit?: Invoice }
  | { kind: 'paid'; invoice: Invoice }
  | { kind: 'expense'; edit?: ProExpense; prefill?: Partial<ProExpense> }
  | { kind: 'urssaf'; decl: Declaration }
  | { kind: 'recurring'; edit?: Partial<Recurring> }

export const proSheet = signal<ProSheetState | null>(null)
export const openPro = (v: ProSheetState) => (proSheet.value = v)

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD']
const TITLES: Record<ProSheetState['kind'], string> = { invoice: 'Facture', paid: 'Facture encaissée 💸', expense: 'Dépense pro', urssaf: 'Déclaration URSSAF', recurring: 'Charge pro fixe' }

export function ProSheets() {
  const v = proSheet.value
  const close = () => (proSheet.value = null)
  const title = v && (v.kind === 'invoice' ? (v.edit ? `Facture ${v.edit.number}` : 'Nouvelle facture') : v.kind === 'expense' && v.edit ? 'Modifier la dépense' : TITLES[v.kind])
  return (
    <Sheet open={!!v} onClose={close} title={title || undefined}>
      {v?.kind === 'invoice' && <InvoiceForm key={v.edit?.id ?? 'new'} edit={v.edit} onDone={close} />}
      {v?.kind === 'paid' && <PaidForm key={v.invoice.id} invoice={v.invoice} onDone={close} />}
      {v?.kind === 'expense' && <ExpenseForm key={v.edit?.id ?? 'new'} edit={v.edit} prefill={v.prefill} onDone={close} />}
      {v?.kind === 'urssaf' && <UrssafForm key={v.decl.key} decl={v.decl} onDone={close} />}
      {v?.kind === 'recurring' && <ProRecurringForm key={v.edit?.id ?? 'new'} initial={v.edit ?? {}} onDone={close} />}
    </Sheet>
  )
}

function InvoiceForm({ edit, onDone }: { edit?: Invoice; onDone: () => void }) {
  const s = state.value
  const p = s.pro.settings
  const [number, setNumber] = useState(edit?.number ?? nextInvoiceNumber(s))
  const [client, setClient] = useState(edit?.client ?? p.client)
  const [date, setDate] = useState(edit?.date ?? today())
  const [currency, setCurrency] = useState(edit?.currency ?? p.currency)
  const [amount, setAmount] = useState(centsToInput(edit?.amount ?? p.invoiceAmount))
  const [note, setNote] = useState(edit?.note ?? '')
  const cents = parseMoney(amount)
  const estimate = invoiceEur({ currency, amount: cents } as Invoice, p)

  const save = (thenPaid = false) => {
    const data = { number: number.trim(), client: client.trim(), date, currency, amount: cents, note: note.trim() || undefined }
    if (edit) saveInvoice({ ...edit, ...data })
    else {
      saveInvoice(data)
      setPro({ client: data.client, currency, invoiceAmount: cents })
    }
    vibrate([10, 30, 10])
    toast(edit ? 'Facture modifiée' : `Facture ${data.number} ajoutée`, '🧾')
    if (thenPaid) {
      const created = state.value.pro.invoices.find((i) => i.number === data.number && i.date === date)
      if (created) return openPro({ kind: 'paid', invoice: created })
    }
    onDone()
  }

  return (
    <div class="form">
      <div class="grid2">
        <label class="field">
          <span>Numéro</span>
          <input class="input" value={number} onInput={(e) => setNumber(e.currentTarget.value)} />
        </label>
        <label class="field">
          <span>Date</span>
          <input class="input" type="date" value={date} onInput={(e) => e.currentTarget.value && setDate(e.currentTarget.value)} />
        </label>
      </div>
      <label class="field">
        <span>Client</span>
        <input class="input" value={client} placeholder="Nom du client" onInput={(e) => setClient(e.currentTarget.value)} />
      </label>
      <div class="grid2">
        <label class="field">
          <span>Montant HT</span>
          <input class="input" inputMode="decimal" value={amount} onInput={(e) => setAmount(e.currentTarget.value)} />
        </label>
        <label class="field">
          <span>Devise</span>
          <select class="input" value={currency} onChange={(e) => setCurrency(e.currentTarget.value)}>
            {CURRENCIES.map((c) => (
              <option value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      {currency !== 'EUR' && cents > 0 && (
        <p class="tiny muted">
          ≈ {money(estimate)} au dernier taux obtenu (1 {currency} = {String(p.fxRate).replace('.', ',')} €)
        </p>
      )}
      <label class="field">
        <span>Note (optionnel)</span>
        <input class="input" value={note} placeholder="Période, mission…" onInput={(e) => setNote(e.currentTarget.value)} />
      </label>
      <p class="tiny muted">Reprends le même numéro que sur ton outil de facturation, je propose toujours le suivant 😉</p>
      <button class="btn block" disabled={!number.trim() || !cents} onClick={() => save()}>
        {edit ? 'Enregistrer' : 'Ajouter la facture 🧾'}
      </button>
      {!edit && (
        <button class="btn ghost block" disabled={!number.trim() || !cents} onClick={() => save(true)}>
          Ajouter et marquer encaissée 💸
        </button>
      )}
      {edit?.paidAt && (
        <button class="btn ghost block" onClick={() => openPro({ kind: 'paid', invoice: edit })}>
          ✏️ Modifier l'encaissement
        </button>
      )}
      {edit && <ConfirmButton label="Supprimer" onConfirm={() => (deleteInvoice(edit.id), onDone())} />}
    </div>
  )
}

function PaidForm({ invoice, onDone }: { invoice: Invoice; onDone: () => void }) {
  const p = state.value.pro.settings
  const [paidAt, setPaidAt] = useState(invoice.paidAt ?? today())
  const [received, setReceived] = useState(centsToInput(invoice.received ?? invoiceEur(invoice, p)))
  const [diff, setDiff] = useState(invoice.declared !== undefined)
  const [declared, setDeclared] = useState(centsToInput(invoice.declared ?? invoice.received ?? invoiceEur(invoice, p)))
  const r = parseMoney(received)
  const foreign = invoice.currency !== 'EUR'
  return (
    <div class="form">
      <div class="card soft">
        <div class="row between">
          <b>{invoice.number}</b>
          <b class="num">{fmtCur(invoice.amount, invoice.currency)}</b>
        </div>
        <div class="tiny muted">
          {invoice.client || 'Client'} · émise le {invoice.date.split('-').reverse().join('/')}
        </div>
      </div>
      <div class="grid2">
        <label class="field">
          <span>Reçu le</span>
          <input class="input" type="date" value={paidAt} onInput={(e) => e.currentTarget.value && setPaidAt(e.currentTarget.value)} />
        </label>
        <label class="field">
          <span>Montant reçu (€)</span>
          <input class="input" inputMode="decimal" value={received} onInput={(e) => setReceived(e.currentTarget.value)} />
        </label>
      </div>
      {foreign && r > 0 && (
        <p class="tiny muted">
          Taux obtenu : 1 {invoice.currency} = {(r / invoice.amount).toFixed(4).replace('.', ',')} € · je m'en sers pour estimer les prochaines factures.
        </p>
      )}
      <ToggleRow label="Montant déclaré différent" hint="Ex : tu déclares le montant facturé converti plutôt que le montant reçu" on={diff} onChange={setDiff} />
      {diff && (
        <label class="field">
          <span>Montant déclaré à l'URSSAF (€)</span>
          <input class="input" inputMode="decimal" value={declared} onInput={(e) => setDeclared(e.currentTarget.value)} />
        </label>
      )}
      <button
        class="btn good block"
        disabled={!r}
        onClick={() => {
          vibrate([10, 30, 10])
          markInvoicePaid(invoice.id, paidAt, r, diff ? parseMoney(declared) : undefined)
          toast(`${money(r, { exact: true })} encaissés, youpi !`, '💸')
          onDone()
        }}
      >
        C'est encaissé ✓
      </button>
      {invoice.paidAt && (
        <button
          class="btn ghost block"
          onClick={() => {
            saveInvoice({ ...invoice, paidAt: undefined, received: undefined, declared: undefined })
            onDone()
          }}
        >
          ↩︎ Pas encore encaissée
        </button>
      )}
    </div>
  )
}

const KIND_LIST = Object.keys(PRO_KINDS) as ProKind[]

function KindPicker({ value, onChange }: { value: ProKind; onChange: (k: ProKind) => void }) {
  return (
    <div class="cat-grid">
      {KIND_LIST.map((k) => (
        <button type="button" class={`cat-btn ${value === k ? 'on' : ''}`} onClick={() => (vibrate(8), onChange(k))}>
          <Bubble emoji={PRO_KINDS[k].emoji} color={PRO_KINDS[k].color} size="sm" />
          <span>{PRO_KINDS[k].label}</span>
        </button>
      ))}
    </div>
  )
}

/** Guess the kind from the label, the way the personal side guesses categories */
const KIND_HINTS: [RegExp, ProKind][] = [
  [/urssaf/i, 'urssaf'],
  [/\bcfe\b/i, 'cfe'],
  [/qonto|shine|swift|banque|frais bancaire|virement/i, 'banque'],
  [/alan|mutuelle|prevoyance|prévoyance|assurance|rc pro|hiscox/i, 'assurance'],
  [/ovh|github|gitkraken|claude|openai|jetbrains|adobe|notion|google|apple|figma|logiciel|abonnement|facture\.net/i, 'logiciels'],
  [/mac|ordinateur|écran|ecran|clavier|souris|trackpad|ipad|iphone/i, 'materiel'],
  [/sncf|train|avion|uber|taxi|hotel|hôtel|essence|péage|peage/i, 'deplacement'],
  [/formation|cours|udemy|livre|conf/i, 'formation'],
  [/comptab|expert/i, 'comptable'],
  [/impot|impôt|dgfip/i, 'impots'],
]
const guessKind = (label: string) => KIND_HINTS.find(([re]) => re.test(label))?.[1]

function ExpenseForm({ edit, prefill, onDone }: { edit?: ProExpense; prefill?: Partial<ProExpense>; onDone: () => void }) {
  const init = edit ?? prefill ?? {}
  const [label, setLabel] = useState(init.label ?? '')
  const [amount, setAmount] = useState(centsToInput(init.amount ?? 0))
  const [kind, setKind] = useState<ProKind>(init.kind ?? 'autre')
  const [touched, setTouched] = useState(!!init.kind)
  const [date, setDate] = useState(init.date ?? today())
  const [note, setNote] = useState(init.note ?? '')
  const [fixed, setFixed] = useState(false)
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const cents = parseMoney(amount)
  const onLabel = (v: string) => {
    setLabel(v)
    const g = !touched && guessKind(v)
    if (g) setKind(g)
  }
  return (
    <div class="form">
      <div class="grid2">
        <label class="field">
          <span>Montant (€)</span>
          <input class="input" inputMode="decimal" value={amount} onInput={(e) => setAmount(e.currentTarget.value)} autoFocus={!init.amount} />
        </label>
        <label class="field">
          <span>{fixed ? 'Prochaine échéance' : 'Date'}</span>
          <input class="input" type="date" value={date} onInput={(e) => e.currentTarget.value && setDate(e.currentTarget.value)} />
        </label>
      </div>
      <label class="field">
        <span>Libellé</span>
        <input class="input" value={label} placeholder="Qonto, Alan, OVH, Claude Code…" onInput={(e) => onLabel(e.currentTarget.value)} />
      </label>
      <div class="field">
        <span>Nature</span>
        <KindPicker value={kind} onChange={(k) => (setKind(k), setTouched(true))} />
      </div>
      <label class="field">
        <span>Note (optionnel)</span>
        <input class="input" value={note} onInput={(e) => setNote(e.currentTarget.value)} />
      </label>
      {!edit && (
        <div class="card soft">
          <ToggleRow label="🔁 Charge fixe" hint="Je l'ajoute toute seule à chaque échéance" on={fixed} onChange={setFixed} />
          {fixed && (
            <select class="input mt" value={frequency} onChange={(e) => setFrequency(e.currentTarget.value as Frequency)}>
              {(Object.keys(FREQ_LABEL) as Frequency[]).map((f) => (
                <option value={f}>{FREQ_LABEL[f]}</option>
              ))}
            </select>
          )}
        </div>
      )}
      <button
        class="btn block"
        disabled={!cents || !label.trim()}
        onClick={() => {
          vibrate([10, 30, 10])
          if (fixed) {
            saveProRecurring({ label: label.trim(), amount: cents, categoryId: kind, type: 'expense', frequency, startDate: date, autoPost: true })
            toast('Charge fixe enregistrée', '🔁')
          } else {
            saveProExpense({ ...edit, label: label.trim(), amount: cents, kind, date, note: note.trim() || undefined })
            toast(edit ? 'Modifié !' : 'Dépense pro notée', PRO_KINDS[kind].emoji)
          }
          onDone()
        }}
      >
        {edit ? 'Enregistrer' : 'Ajouter la dépense pro 💼'}
      </button>
      {edit && <ConfirmButton label="Supprimer" onConfirm={() => (deleteProExpense(edit.id), onDone())} />}
    </div>
  )
}

function UrssafForm({ decl, onDone }: { decl: Declaration; onDone: () => void }) {
  const [amount, setAmount] = useState(centsToInput(decl.paid || decl.estimate))
  const [date, setDate] = useState(today())
  const copy = () => {
    navigator.clipboard?.writeText((decl.ca / 100).toFixed(2).replace('.', ',')).then(() => toast('Copié !', '📋'), () => {})
  }
  return (
    <div class="form">
      <div class="card soft center">
        <div class="small muted">CA encaissé à déclarer · {declLabel(decl.key)}</div>
        <button class="big num bold" style={{ fontSize: 32 }} onClick={copy}>
          {money(decl.ca, { exact: true })}
        </button>
        <div class="tiny muted">Touche le montant pour le copier · à déclarer avant le {decl.due.split('-').reverse().join('/')}</div>
      </div>
      <a class="btn ghost block" href="https://autoentrepreneur.urssaf.fr" target="_blank" rel="noopener">
        🏛️ Ouvrir autoentrepreneur.urssaf.fr
      </a>
      <div class="grid2">
        <label class="field">
          <span>Montant payé (€)</span>
          <input class="input" inputMode="decimal" value={amount} onInput={(e) => setAmount(e.currentTarget.value)} />
        </label>
        <label class="field">
          <span>Prélevé le</span>
          <input class="input" type="date" value={date} onInput={(e) => e.currentTarget.value && setDate(e.currentTarget.value)} />
        </label>
      </div>
      <p class="tiny muted">Estimation : {money(decl.estimate, { exact: true })}. Mets le montant exact affiché par l'URSSAF.</p>
      <button
        class="btn good block"
        onClick={() => {
          vibrate([10, 30, 10])
          saveProExpense({ date, label: `URSSAF ${declLabel(decl.key)}`, amount: parseMoney(amount), kind: 'urssaf', urssafPeriod: decl.key })
          toast('Déclaration faite, bravo !', '🏛️')
          onDone()
        }}
      >
        Déclarée et payée ✓
      </button>
    </div>
  )
}

function ProRecurringForm({ initial, onDone }: { initial: Partial<Recurring>; onDone: () => void }) {
  const [label, setLabel] = useState(initial.label ?? '')
  const [amount, setAmount] = useState(centsToInput(initial.amount ?? 0))
  const [kind, setKind] = useState<ProKind>((initial.categoryId as ProKind) ?? 'logiciels')
  const [frequency, setFrequency] = useState<Frequency>(initial.frequency ?? 'monthly')
  const [startDate, setStartDate] = useState(initial.startDate ?? addDays(today(), 1))
  const [paused, setPaused] = useState(initial.paused ?? false)
  return (
    <div class="form">
      <label class="field">
        <span>Libellé</span>
        <input class="input" value={label} placeholder="Qonto, Alan, OVH…" onInput={(e) => setLabel(e.currentTarget.value)} />
      </label>
      <div class="grid2">
        <label class="field">
          <span>Montant (€)</span>
          <input class="input" inputMode="decimal" value={amount} onInput={(e) => setAmount(e.currentTarget.value)} />
        </label>
        <label class="field">
          <span>{initial.id ? 'Première échéance' : 'Prochaine échéance'}</span>
          <input class="input" type="date" value={startDate} onInput={(e) => e.currentTarget.value && setStartDate(e.currentTarget.value)} />
        </label>
      </div>
      <label class="field">
        <span>Fréquence</span>
        <select class="input" value={frequency} onChange={(e) => setFrequency(e.currentTarget.value as Frequency)}>
          {(Object.keys(FREQ_LABEL) as Frequency[]).map((f) => (
            <option value={f}>{FREQ_LABEL[f]}</option>
          ))}
        </select>
      </label>
      <div class="field">
        <span>Nature</span>
        <KindPicker value={kind} onChange={setKind} />
      </div>
      {initial.id && <ToggleRow label="En pause" on={paused} onChange={setPaused} />}
      <button
        class="btn block"
        disabled={!label.trim() || !parseMoney(amount)}
        onClick={() => {
          saveProRecurring({ ...(initial as Recurring), label: label.trim(), amount: parseMoney(amount), categoryId: kind, type: 'expense', frequency, startDate, autoPost: true, paused })
          toast('Charge fixe enregistrée', '🔁')
          onDone()
        }}
      >
        Enregistrer
      </button>
      {initial.id && <ConfirmButton label="Supprimer" onConfirm={() => (deleteProRecurring(initial.id!), onDone())} />}
    </div>
  )
}
