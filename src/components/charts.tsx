import type { ComponentChildren } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { clamp, money } from '../lib/utils'

/** Animated donut. Segments are drawn as dashed circles on the same ring. */
export function Donut({ data, size = 190, stroke = 26, children, onPick }: { data: { id: string; value: number; color: string }[]; size?: number; stroke?: number; children?: ComponentChildren; onPick?: (id: string) => void }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(r)
  }, [])
  const r = (size - stroke) / 2
  const C = 2 * Math.PI * r
  const total = data.reduce((a, d) => a + d.value, 0) || 1
  let acc = 0
  const gap = data.length > 1 ? 2 : 0
  return (
    <div class="donut-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" stroke-width={stroke} />
        {data.map((d) => {
          const len = (d.value / total) * C
          const off = acc
          acc += len
          return (
            <circle
              class="donut-seg"
              key={d.id}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color}
              stroke-width={stroke}
              stroke-linecap="butt"
              stroke-dasharray={shown ? `${Math.max(0.01, len - gap)} ${C}` : `0 ${C}`}
              stroke-dashoffset={-off}
              onClick={() => onPick?.(d.id)}
              style={{ cursor: onPick ? 'pointer' : undefined }}
            />
          )
        })}
      </svg>
      <div class="center">{children}</div>
    </div>
  )
}

/** Income vs expense bars per month */
export function MonthBars({ data }: { data: { label: string; income: number; expense: number }[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]))
  return (
    <div class="bars">
      {data.map((d, i) => (
        <div class="b" key={d.label}>
          <div class="pair">
            <i style={{ height: `${(d.income / max) * 100}%`, background: 'var(--good)', animationDelay: `${i * 0.06}s` }} title={money(d.income)} />
            <i style={{ height: `${(d.expense / max) * 100}%`, background: 'var(--accent)', animationDelay: `${i * 0.06 + 0.03}s` }} title={money(d.expense)} />
          </div>
          <span>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

/** Piggy-jar gauge with a waving liquid level */
export function Jar({ value, color = 'var(--accent)', size = 120, emoji }: { value: number; color?: string; size?: number; emoji?: string }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setV(clamp(value, 0, 1)), 60)
    return () => clearTimeout(t)
  }, [value])
  const [id] = useState(() => 'jar' + Math.random().toString(36).slice(2, 7))
  const top = 22
  const bottom = 112
  const y = bottom - (bottom - top) * v
  return (
    <svg class="jar" width={size} height={size} viewBox="0 0 100 120">
      <defs>
        <clipPath id={id}>
          <path d="M22 22 h56 q8 0 8 10 v70 q0 12 -12 12 h-48 q-12 0 -12 -12 v-70 q0 -10 8 -10z" />
        </clipPath>
      </defs>
      <rect x="30" y="6" width="40" height="12" rx="5" fill="var(--ink-faint)" opacity=".6" />
      <path d="M22 22 h56 q8 0 8 10 v70 q0 12 -12 12 h-48 q-12 0 -12 -12 v-70 q0 -10 8 -10z" fill="var(--card-2)" stroke="var(--line)" stroke-width="3" />
      <g clip-path={`url(#${id})`}>
        <g style={{ transform: `translateY(${y - 22}px)`, transition: 'transform 1.4s cubic-bezier(.34,1.56,.64,1)' }}>
          <path class="wave" d="M0 22 q10 -6 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 v120 h-140z" fill={color} opacity=".95" />
          <path class="wave" style={{ animationDuration: '4.5s' }} d="M0 24 q10 -5 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 v120 h-140z" fill="#fff" opacity=".18" />
        </g>
      </g>
      <ellipse cx="34" cy="44" rx="4" ry="12" fill="#fff" opacity=".5" />
      {emoji && (
        <text x="50" y="76" text-anchor="middle" font-size="30">
          {emoji}
        </text>
      )}
    </svg>
  )
}

export function Ring({ value, size = 84, stroke = 9, color = 'var(--accent)', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ComponentChildren }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setV(clamp(value, 0, 1)), 50)
    return () => clearTimeout(t)
  }, [value])
  const r = (size - stroke) / 2
  const C = 2 * Math.PI * r
  return (
    <div class="level-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" stroke-width={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} stroke-width={stroke} stroke-linecap="round" stroke-dasharray={`${C * v} ${C}`} style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.34,1.56,.64,1)' }} />
      </svg>
      <div class="n">{children}</div>
    </div>
  )
}
