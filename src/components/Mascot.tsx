import type { Mood } from '../lib/game'

/** Mochi, the piggy-bank mascot. Pure SVG so it scales and animates with CSS. */
export function Mascot({ mood = 'happy', size = 96, crown = false, onClick }: { mood?: Mood; size?: number; crown?: boolean; onClick?: () => void }) {
  const closed = mood === 'sleepy'
  return (
    <svg class={`mascot ${mood}`} width={size} height={size * 0.92} viewBox="0 0 120 110" onClick={onClick} role="img" aria-label="Mochi">
      <g class="body">
        {/* tail */}
        <path d="M14 62 q-10 -4 -6 -12 q4 -6 8 0 q2 4 -3 5" fill="none" stroke="#f58db0" stroke-width="3.5" stroke-linecap="round" />
        {/* legs */}
        <rect x="30" y="84" width="14" height="16" rx="7" fill="#f7a3c0" />
        <rect x="76" y="84" width="14" height="16" rx="7" fill="#f7a3c0" />
        {/* ears */}
        <path d="M30 30 L26 8 Q38 12 46 24 Z" fill="#f7a3c0" stroke="#f58db0" stroke-width="2" stroke-linejoin="round" />
        <path d="M90 30 L94 8 Q82 12 74 24 Z" fill="#f7a3c0" stroke="#f58db0" stroke-width="2" stroke-linejoin="round" />
        {/* body */}
        <ellipse cx="60" cy="58" rx="46" ry="38" fill="#ffc4d8" />
        <ellipse cx="60" cy="66" rx="34" ry="24" fill="#ffd6e4" />
        <ellipse cx="46" cy="34" rx="12" ry="6" fill="#fff" opacity=".5" />
        {/* coin slot */}
        <rect x="50" y="22" width="20" height="5" rx="2.5" fill="#e77aa1" />
        {/* cheeks */}
        <ellipse cx="30" cy="62" rx="8" ry="5" fill="#ff8fb5" opacity=".55" />
        <ellipse cx="90" cy="62" rx="8" ry="5" fill="#ff8fb5" opacity=".55" />
        {/* eyes */}
        {closed ? (
          <>
            <path d="M36 50 q6 5 12 0" stroke="#4a3a52" stroke-width="3" fill="none" stroke-linecap="round" />
            <path d="M72 50 q6 5 12 0" stroke="#4a3a52" stroke-width="3" fill="none" stroke-linecap="round" />
          </>
        ) : (
          <>
            <g class="eye">
              <ellipse cx="42" cy="49" rx="5.5" ry="6.5" fill="#4a3a52" />
              <circle cx="44" cy="46.5" r="2.2" fill="#fff" />
            </g>
            <g class="eye">
              <ellipse cx="78" cy="49" rx="5.5" ry="6.5" fill="#4a3a52" />
              <circle cx="80" cy="46.5" r="2.2" fill="#fff" />
            </g>
          </>
        )}
        {mood === 'worried' && (
          <>
            <path d="M34 39 l12 4" stroke="#4a3a52" stroke-width="2.5" stroke-linecap="round" />
            <path d="M86 39 l-12 4" stroke="#4a3a52" stroke-width="2.5" stroke-linecap="round" />
            <path d="M98 34 q4 8 0 10 q-4 -2 0 -10" fill="#8fd3ff" />
          </>
        )}
        {/* snout */}
        <ellipse cx="60" cy="63" rx="13" ry="9" fill="#f7a3c0" />
        <ellipse cx="55" cy="63" rx="2.6" ry="3.4" fill="#d9668f" />
        <ellipse cx="65" cy="63" rx="2.6" ry="3.4" fill="#d9668f" />
        {/* mouth */}
        {mood === 'worried' ? (
          <path d="M52 79 q4 -3 8 0 q4 3 8 0" stroke="#4a3a52" stroke-width="2.5" fill="none" stroke-linecap="round" />
        ) : mood === 'party' ? (
          <path d="M51 76 q9 11 18 0 z" fill="#d9668f" stroke="#4a3a52" stroke-width="2" stroke-linejoin="round" />
        ) : (
          <path d="M53 77 q7 6 14 0" stroke="#4a3a52" stroke-width="2.5" fill="none" stroke-linecap="round" />
        )}
      </g>
      {mood === 'sleepy' && (
        <text class="zz" x="96" y="22" font-size="16" font-weight="700" fill="#a68bff">
          z
        </text>
      )}
      {mood === 'love' && (
        <path class="heart" d="M100 20 c-3 -6 -11 -4 -10 2 c1 5 10 10 10 10 c0 0 9 -5 10 -10 c1 -6 -7 -8 -10 -2z" fill="#ff6f8e" />
      )}
      {mood === 'party' && !crown && (
        <g>
          <path d="M60 2 L50 22 L70 22 Z" fill="#a68bff" />
          <circle cx="60" cy="2" r="3.5" fill="#ffd166" />
          <circle cx="56" cy="16" r="1.6" fill="#fff" />
          <circle cx="63" cy="12" r="1.6" fill="#fff" />
        </g>
      )}
      {crown && <path d="M44 20 L48 6 L55 14 L60 3 L65 14 L72 6 L76 20 Z" fill="#ffd166" stroke="#f2b134" stroke-width="2" stroke-linejoin="round" />}
    </svg>
  )
}
