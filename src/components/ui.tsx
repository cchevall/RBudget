import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { celebrations, confettiTick, toasts, xpFloat } from '../store/store'
import { clamp, money, vibrate } from '../lib/utils'
import { burst } from './confetti'

// ---------- Bottom sheet ----------

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ComponentChildren }) {
  const [closing, setClosing] = useState(false)
  const [visible, setVisible] = useState(open)
  useEffect(() => {
    if (open) {
      setVisible(true)
      setClosing(false)
    } else if (visible) {
      setClosing(true)
      const t = setTimeout(() => setVisible(false), 240)
      return () => clearTimeout(t)
    }
  }, [open])
  useEffect(() => {
    if (!visible) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => void (document.body.style.overflow = prev)
  }, [visible])
  if (!visible) return null
  return (
    <>
      <div class={`sheet-backdrop ${closing ? 'closing' : ''}`} onClick={onClose} />
      <div class={`sheet ${closing ? 'closing' : ''}`} role="dialog">
        <div class="grab" />
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </>
  )
}

// ---------- Small widgets ----------

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button type="button" class={`switch ${on ? 'on' : ''}`} onClick={() => (vibrate(), onChange(!on))} aria-pressed={on} />
}

export function ToggleRow({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label class="toggle-row">
      <div>
        <div class="bold">{label}</div>
        {hint && <div class="small muted">{hint}</div>}
      </div>
      <Switch on={on} onChange={onChange} />
    </label>
  )
}

export function Bar({ value, color, kind = '', tick }: { value: number; color?: string; kind?: '' | 'thin' | 'fat'; tick?: number }) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const r = requestAnimationFrame(() => setW(clamp(value, 0, 1)))
    return () => cancelAnimationFrame(r)
  }, [value])
  return (
    <div class={`bar ${kind}`}>
      <i style={{ width: `${w * 100}%`, background: color }} />
      {tick !== undefined && tick > 0 && tick < 1 && <span class="tick" style={{ left: `${tick * 100}%` }} />}
    </div>
  )
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div class="seg">
      {options.map(([v, l]) => (
        <button type="button" class={v === value ? 'on' : ''} onClick={() => (vibrate(), onChange(v))}>
          {l}
        </button>
      ))}
    </div>
  )
}

/** Number that counts up to its value */
export function CountUp({ value, format = (n: number) => money(n) }: { value: number; format?: (n: number) => string }) {
  const [v, setV] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    const d = 700
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / d)
      const e = 1 - Math.pow(1 - k, 3)
      setV(Math.round(a + (value - a) * e))
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{format(v)}</>
}

export function Empty({ emoji, title, text, children }: { emoji: string; title: string; text?: string; children?: ComponentChildren }) {
  return (
    <div class="empty">
      <span class="big">{emoji}</span>
      <div class="bold" style={{ color: 'var(--ink)' }}>
        {title}
      </div>
      {text && <p class="small mt">{text}</p>}
      {children && <div class="mt">{children}</div>}
    </div>
  )
}

export function Header({ title, back = true, right }: { title: string; back?: boolean; right?: ComponentChildren }) {
  return (
    <div class="head">
      {back && (
        <button class="back" onClick={() => (history.length > 1 ? history.back() : (location.hash = '#/'))} aria-label="Retour">
          ‹
        </button>
      )}
      <h1>{title}</h1>
      {right}
    </div>
  )
}

export const Bubble = ({ emoji, color, size = '' }: { emoji: string; color: string; size?: '' | 'sm' | 'lg' }) => (
  <span class={`bubble ${size}`} style={{ background: color + '55' }}>
    {emoji}
  </span>
)

// ---------- Global overlays ----------

export function Toasts() {
  return (
    <div class="toasts">
      {toasts.value.map((t) => (
        <div class="toast" key={t.id}>
          <span>{t.emoji}</span>
          <span>{t.text}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action!.run()
                toasts.value = toasts.value.filter((x) => x.id !== t.id)
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export function XpFloat() {
  const x = xpFloat.value
  if (!x) return null
  return (
    <div class="xp-float" key={x.id} onAnimationEnd={() => (xpFloat.value = null)}>
      +{x.amount} XP ✨
    </div>
  )
}

export function Celebrations() {
  const c = celebrations.value[0]
  useEffect(() => {
    if (c) {
      burst()
      vibrate([20, 40, 20])
    }
  }, [c?.id])
  if (!c) return null
  return (
    <div class="celebrate" onClick={() => (celebrations.value = celebrations.value.slice(1))}>
      <div class="box" onClick={(e) => e.stopPropagation()}>
        <div class="tiny bold" style={{ color: 'var(--accent-deep)', letterSpacing: '0.1em' }}>
          SUCCÈS DÉBLOQUÉ
        </div>
        <span class="emoji">{c.emoji}</span>
        <h2>{c.title}</h2>
        <p class="muted mt">{c.text}</p>
        <button class="btn block mt-l" onClick={() => (celebrations.value = celebrations.value.slice(1))}>
          Trop bien ! 🎉
        </button>
      </div>
    </div>
  )
}

export function ConfettiListener() {
  const n = confettiTick.value
  useEffect(() => {
    if (n) burst()
  }, [n])
  return null
}

/** Destructive button asking for a second tap instead of a browser dialog */
export function ConfirmButton({ label, confirmLabel = 'Sûr·e ? Appuie encore', onConfirm, class: cls = 'btn danger block' }: { label: string; confirmLabel?: string; onConfirm: () => void; class?: string }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      class={`${cls} ${armed ? 'wiggle' : ''}`}
      onClick={() => {
        vibrate(armed ? [20, 30, 20] : 10)
        if (armed) onConfirm()
        setArmed(!armed)
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}
