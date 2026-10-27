import type { Transaction } from '../store/types'
import { cat, state } from '../store/store'
import { money, periodLabel, shiftPeriod, vibrate } from '../lib/utils'
import { openEdit } from './AddSheet'
import { Bubble } from './ui'

export function TxRow({ t, showDate }: { t: Transaction; showDate?: boolean }) {
  const c = cat(t.categoryId)
  const parent = c.parentId ? cat(c.parentId) : null
  const waiting = t.reimb && ((t.reimb.secu > 0 && !t.reimb.secuAt) || (t.reimb.mutuelle > 0 && !t.reimb.mutuelleAt))
  return (
    <button class="item" onClick={() => (vibrate(), openEdit(t))}>
      <Bubble emoji={c.emoji} color={c.color} />
      <div class="grow">
        <div class="bold ellipsis">{t.label || c.name}</div>
        <div class="small muted ellipsis">
          {parent ? `${parent.name} · ` : ''}
          {t.label && t.label !== c.name ? c.name : ''}
          {showDate && ` · ${t.date.slice(8)}/${t.date.slice(5, 7)}`}
          {t.recurringId && ' 🔁'}
          {t.note && ` · ${t.note}`}
        </div>
      </div>
      <div class="col" style={{ alignItems: 'flex-end', gap: 2 }}>
        <span class={`amount ${t.type === 'income' ? 'in' : ''}`}>
          {t.type === 'income' ? '+' : '−'}
          {money(t.amount, { exact: true })}
        </span>
        {waiting && <span class="badge warn">⏳ remb.</span>}
        {t.reimb && !waiting && <span class="badge good">✓ remb.</span>}
      </div>
    </button>
  )
}

export function PeriodSwitch({ value, onChange }: { value: string; onChange: (p: string) => void }) {
  return (
    <div class="row between card" style={{ padding: '8px 10px' }}>
      <button class="icon-btn" onClick={() => onChange(shiftPeriod(value, -1))} aria-label="Mois précédent">
        ‹
      </button>
      <b>{periodLabel(value)}</b>
      <button class="icon-btn" onClick={() => onChange(shiftPeriod(value, 1))} aria-label="Mois suivant">
        ›
      </button>
    </div>
  )
}

const EMOJIS = ['🎯', '🏖️', '✈️', '🏠', '🚗', '🎄', '🎁', '💍', '👶', '🐶', '🎓', '💻', '📱', '🛋️', '🌴', '⛷️', '🏕️', '🎢', '💐', '🧸', '🐷', '💰', '🌈', '⭐', '🍰', '🎮', '👗', '🚲', '🩺', '📚', '🎨', '🎤']

export function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  return (
    <div class="chips wrap" style={{ flexWrap: 'wrap' }}>
      {EMOJIS.map((e) => (
        <button type="button" class={`chip ${value === e ? 'on' : ''}`} style={{ fontSize: 20, padding: '4px 9px' }} onClick={() => onChange(e)}>
          {e}
        </button>
      ))}
    </div>
  )
}

export const PASTELS = ['#ffb7cf', '#ffd59e', '#9be3c4', '#a8d8ff', '#c9b6ff', '#ffad9e', '#9fe6e0', '#ffe08a', '#f0c0ff', '#d0d8e8']

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div class="row wrap gap-s">
      {PASTELS.map((c) => (
        <button type="button" onClick={() => onChange(c)} style={{ width: 34, height: 34, borderRadius: 12, background: c, border: value === c ? '3px solid var(--ink)' : '3px solid transparent', transition: 'transform .2s var(--spring)', transform: value === c ? 'scale(1.1)' : undefined }} />
      ))}
    </div>
  )
}

export function CategorySelect({ value, onChange, kind }: { value: string; onChange: (id: string) => void; kind?: 'expense' | 'income' }) {
  const all = state.value.categories.filter((c) => !c.archived && (!kind || c.kind === kind))
  const tops = all.filter((c) => !c.parentId)
  return (
    <select class="input" value={value} onChange={(e) => onChange(e.currentTarget.value)}>
      <option value="">Choisir…</option>
      {tops.map((t) => {
        const kids = all.filter((c) => c.parentId === t.id)
        return kids.length ? (
          <optgroup label={`${t.emoji} ${t.name}`}>
            <option value={t.id}>
              {t.emoji} {t.name} (général)
            </option>
            {kids.map((k) => (
              <option value={k.id}>
                {k.emoji} {k.name}
              </option>
            ))}
          </optgroup>
        ) : (
          <option value={t.id}>
            {t.emoji} {t.name}
          </option>
        )
      })}
    </select>
  )
}
