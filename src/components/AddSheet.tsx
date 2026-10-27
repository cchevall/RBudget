import { signal } from '@preact/signals'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { addTransaction, cat, deleteTransaction, fireConfetti, state, toast, updateTransaction } from '../store/store'
import type { Reimbursement, Transaction, TxType } from '../store/types'
import { favorites, suggestCategories, suggestLabels } from '../lib/autocat'
import { addDays, centsToInput, currentPeriod, money, parseMoney, today, vibrate } from '../lib/utils'
import { envelopeStatus } from '../lib/stats'
import { Bubble, Seg, Sheet, ToggleRow } from './ui'

/** Open with nothing (new), a prefill, or an existing transaction to edit */
export const addSheet = signal<{ open: boolean; edit?: Transaction; prefill?: Partial<Transaction> }>({ open: false })
export const openAdd = (prefill?: Partial<Transaction>) => (addSheet.value = { open: true, prefill })
export const openEdit = (edit: Transaction) => (addSheet.value = { open: true, edit })

const HEALTH = new Set(['sante', 'sante-medecin', 'sante-kine', 'sante-osteo', 'sante-pharma', 'enf-sante'])

/** Rough French reimbursement estimates, always editable */
function estimateReimb(categoryId: string, amount: number): Reimbursement {
  const r = (x: number) => Math.max(0, Math.round(x))
  switch (categoryId) {
    case 'sante-medecin':
    case 'enf-sante': {
      const secu = r(Math.min(amount, 3000) * 0.7 - (categoryId === 'sante-medecin' ? 200 : 0))
      return { secu, mutuelle: r(amount - secu - (categoryId === 'sante-medecin' ? 200 : 0)) }
    }
    case 'sante-kine':
      return { secu: r(amount * 0.6), mutuelle: r(amount * 0.4) }
    case 'sante-pharma':
      return { secu: r(amount * 0.65), mutuelle: r(amount * 0.35) }
    case 'sante-osteo':
      return { secu: 0, mutuelle: r(Math.min(amount, 5000) * 0.5) }
    default:
      return { secu: r(amount * 0.7), mutuelle: r(amount * 0.3) }
  }
}

export function AddSheet() {
  const { open, edit, prefill } = addSheet.value
  const close = () => (addSheet.value = { open: false })
  return (
    <Sheet open={open} onClose={close}>
      {open && <AddForm key={edit?.id ?? 'new'} edit={edit} prefill={prefill} onDone={close} />}
    </Sheet>
  )
}

function AddForm({ edit, prefill, onDone }: { edit?: Transaction; prefill?: Partial<Transaction>; onDone: () => void }) {
  const s = state.value
  const init = edit ?? prefill ?? {}
  const [type, setType] = useState<TxType>(init.type ?? 'expense')
  const [raw, setRaw] = useState(init.amount ? centsToInput(init.amount) : '')
  const [step, setStep] = useState<1 | 2>(edit || init.amount ? 2 : 1)
  const [label, setLabel] = useState(init.label ?? '')
  const [categoryId, setCategoryId] = useState(init.categoryId ?? '')
  const [openParent, setOpenParent] = useState<string | null>(null)
  const [date, setDate] = useState(init.date ?? today())
  const [note, setNote] = useState(init.note ?? '')
  const [reimbOn, setReimbOn] = useState(!!init.reimb)
  const [reimb, setReimb] = useState<{ secu: string; mutuelle: string }>({ secu: centsToInput(init.reimb?.secu ?? 0), mutuelle: centsToInput(init.reimb?.mutuelle ?? 0) })
  const [bump, setBump] = useState(0)
  const amount = parseMoney(raw)

  const favs = useMemo(() => (type === 'expense' ? favorites(s) : []), [type])
  const tops = s.categories.filter((c) => c.kind === type && !c.parentId && !c.archived)
  const children = (id: string) => s.categories.filter((c) => c.parentId === id && !c.archived)
  const suggestions = useMemo(() => suggestCategories(s, label).filter((id) => cat(id).kind === type), [label, type])
  const labelHints = useMemo(() => (label.length >= 1 ? suggestLabels(s, label, type).filter((h) => h.label !== label) : []), [label, type])
  const isHealth = HEALTH.has(categoryId)

  // Auto-pick the best guess while the user hasn't chosen
  const [touchedCat, setTouchedCat] = useState(!!init.categoryId)
  useEffect(() => {
    if (!touchedCat && suggestions[0]) setCategoryId(suggestions[0])
  }, [suggestions[0]])
  useEffect(() => {
    if (isHealth && !edit && type === 'expense') {
      setReimbOn(true)
      const e = estimateReimb(categoryId, amount)
      setReimb({ secu: centsToInput(e.secu), mutuelle: centsToInput(e.mutuelle) })
    }
  }, [categoryId])

  const press = (k: string) => {
    vibrate(8)
    setBump((b) => b + 1)
    if (k === '⌫') return setRaw((r) => r.slice(0, -1))
    if (k === ',') return setRaw((r) => (r.includes(',') ? r : (r || '0') + ','))
    setRaw((r) => {
      const [, dec] = r.split(',')
      if (dec !== undefined && dec.length >= 2) return r
      if (r === '0') return k
      if (r.replace(',', '').length >= 7) return r
      return r + k
    })
  }

  const save = () => {
    if (!amount || !categoryId) return
    const data = {
      type,
      amount,
      date,
      categoryId,
      label: label.trim(),
      note: note.trim() || undefined,
      reimb: reimbOn && isHealth && type === 'expense' ? { ...(edit?.reimb ?? {}), secu: parseMoney(reimb.secu), mutuelle: parseMoney(reimb.mutuelle) } : undefined,
    }
    if (edit) {
      updateTransaction(edit.id, data)
      toast('Modifié !', '✏️')
    } else {
      addTransaction({ ...prefill, ...data })
      vibrate([10, 30, 10])
      afterAdd(categoryId, type)
    }
    onDone()
  }

  const quickAdd = (f: { label: string; categoryId: string; amount: number }) => {
    addTransaction({ type: 'expense', amount: f.amount, date: today(), categoryId: f.categoryId, label: f.label })
    vibrate([10, 30, 10])
    afterAdd(f.categoryId, 'expense')
    onDone()
  }

  if (step === 1)
    return (
      <div>
        <Seg value={type} onChange={setType} options={[['expense', '💸 Dépense'], ['income', '💰 Revenu']]} />
        <div class={`amount-display ${bump % 2 ? 'bump' : ''}`} key={bump} style={{ color: type === 'income' ? 'var(--good)' : 'var(--ink)' }}>
          {raw || '0'} <span style={{ fontSize: 28 }}>€</span>
        </div>
        {favs.length > 0 && !raw && (
          <>
            <div class="small muted center">ou en un tap ⚡</div>
            <div class="chips mt" style={{ justifyContent: favs.length < 3 ? 'center' : undefined }}>
              {favs.map((f) => (
                <button class="chip" onClick={() => quickAdd(f)}>
                  {cat(f.categoryId).emoji} {f.label || cat(f.categoryId).name} · {money(f.amount)}
                </button>
              ))}
            </div>
          </>
        )}
        <div class="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'].map((k) => (
            <button type="button" onClick={() => press(k)}>
              {k}
            </button>
          ))}
        </div>
        <button class="btn block mt" disabled={!amount} onClick={() => setStep(2)}>
          Suivant →
        </button>
      </div>
    )

  return (
    <div class="form" style={{ animation: 'page-in .35s var(--ease)' }}>
      <div class="row between">
        <button class="chip" onClick={() => setStep(1)}>
          ✏️ {money(amount, { exact: true })}
        </button>
        <Seg value={type} onChange={(t) => (setType(t), setCategoryId(''), setTouchedCat(false))} options={[['expense', 'Dépense'], ['income', 'Revenu']]} />
      </div>

      <label class="field">
        <span>Libellé</span>
        <input class="input" value={label} placeholder={type === 'expense' ? 'Carrefour, boulangerie, cantine…' : 'Salaire, CAF…'} onInput={(e) => setLabel(e.currentTarget.value)} />
      </label>
      {labelHints.length > 0 && (
        <div class="chips" style={{ marginTop: -6 }}>
          {labelHints.map((h) => (
            <button
              class="chip"
              onClick={() => {
                setLabel(h.label)
                setCategoryId(h.categoryId)
                setTouchedCat(true)
              }}
            >
              {cat(h.categoryId).emoji} {h.label}
            </button>
          ))}
        </div>
      )}

      <div class="field">
        <span>Catégorie {suggestions.length > 0 && !touchedCat && <em class="badge">✨ devinée</em>}</span>
        <div class="cat-grid">
          {tops.map((c) => {
            const kids = children(c.id)
            const on = categoryId === c.id || kids.some((k) => k.id === categoryId)
            return (
              <button
                type="button"
                class={`cat-btn ${on ? 'on' : ''}`}
                onClick={() => {
                  vibrate(8)
                  setTouchedCat(true)
                  if (kids.length) setOpenParent(openParent === c.id ? null : c.id)
                  if (!kids.some((k) => k.id === categoryId)) setCategoryId(c.id)
                }}
              >
                <Bubble emoji={c.emoji} color={c.color} size="sm" />
                <span>
                  {c.name}
                  {kids.length > 0 && ' ›'}
                </span>
              </button>
            )
          })}
        </div>
        {(openParent || cat(categoryId).parentId) && (
          <div class="chips" style={{ animation: 'pop-in .35s var(--spring)' }}>
            {(() => {
              const pid = openParent ?? cat(categoryId).parentId!
              return [cat(pid), ...children(pid)].map((k) => (
                <button class={`chip ${categoryId === k.id ? 'on' : ''}`} onClick={() => (setCategoryId(k.id), setTouchedCat(true))}>
                  {k.emoji} {k.id === pid ? 'Général' : k.name}
                </button>
              ))
            })()}
          </div>
        )}
      </div>

      <div class="field">
        <span>Date</span>
        <div class="row wrap gap-s">
          <button class={`chip ${date === today() ? 'on' : ''}`} onClick={() => setDate(today())}>
            Aujourd'hui
          </button>
          <button class={`chip ${date === addDays(today(), -1) ? 'on' : ''}`} onClick={() => setDate(addDays(today(), -1))}>
            Hier
          </button>
          <input type="date" class="input" style={{ flex: 1, minHeight: 38, padding: '6px 12px', minWidth: 140 }} value={date} onInput={(e) => e.currentTarget.value && setDate(e.currentTarget.value)} />
        </div>
      </div>

      {isHealth && type === 'expense' && (
        <div class="card soft">
          <ToggleRow label="💚 Suivre le remboursement" hint="Estimation Sécu / mutuelle, modifiable" on={reimbOn} onChange={setReimbOn} />
          {reimbOn && (
            <div class="grid2 mt">
              <label class="field">
                <span>Sécu attendue</span>
                <input class="input" inputMode="decimal" value={reimb.secu} onInput={(e) => setReimb({ ...reimb, secu: e.currentTarget.value })} />
              </label>
              <label class="field">
                <span>Mutuelle attendue</span>
                <input class="input" inputMode="decimal" value={reimb.mutuelle} onInput={(e) => setReimb({ ...reimb, mutuelle: e.currentTarget.value })} />
              </label>
            </div>
          )}
        </div>
      )}

      <label class="field">
        <span>Note (optionnel)</span>
        <input class="input" value={note} placeholder="Pour qui, pourquoi…" onInput={(e) => setNote(e.currentTarget.value)} />
      </label>

      <button class="btn block" disabled={!amount || !categoryId} onClick={save}>
        {edit ? 'Enregistrer' : type === 'expense' ? 'Ajouter la dépense ✨' : 'Ajouter le revenu 💰'}
      </button>
      {edit && (
        <button
          class="btn danger block"
          onClick={() => {
            deleteTransaction(edit.id)
            onDone()
          }}
        >
          Supprimer
        </button>
      )}
    </div>
  )
}

/** Friendly feedback after adding, including envelope warnings */
function afterAdd(categoryId: string, type: TxType) {
  const s = state.value
  if (type === 'income') {
    fireConfetti()
    return toast('Revenu ajouté, youpi !', '💰')
  }
  const c = cat(categoryId)
  const env = s.envelopes.find((e) => e.categoryId === categoryId || e.categoryId === c.parentId)
  if (env) {
    const st = envelopeStatus(s, env, currentPeriod())
    if (st.left < 0) return toast(`Enveloppe ${cat(env.categoryId).name} dépassée de ${money(-st.left)}`, '😬')
    if (st.ratio > 0.8) return toast(`Plus que ${money(st.left)} dans ${cat(env.categoryId).name}`, '👀')
    return toast(`C'est noté ! Reste ${money(st.left)} en ${cat(env.categoryId).name}`, c.emoji)
  }
  toast("C'est noté !", c.emoji)
}
