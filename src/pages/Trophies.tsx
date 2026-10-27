import { state, update, toast } from '../store/store'
import { ACHIEVEMENTS, bestStreak, levelOf, streak, THEMES } from '../lib/game'
import { Ring } from '../components/charts'
import { Header } from '../components/ui'
import { Mascot } from '../components/Mascot'
import { Challenges } from './Home'

export function Trophies() {
  const s = state.value
  const lvl = levelOf(s.game.xp)
  const str = streak(s.game.checkins)
  const unlocked = ACHIEVEMENTS.filter((a) => s.game.unlocked[a.id]).length
  return (
    <div class="page">
      <Header title="Trophées" />
      <div class="card">
        <div class="row gap-l">
          <Ring value={lvl.progress} size={92}>
            {lvl.level}
          </Ring>
          <div class="grow">
            <div class="tiny muted bold">NIVEAU {lvl.level}</div>
            <h2>{lvl.name}</h2>
            <div class="small muted">
              {s.game.xp} XP · encore {lvl.toNext} XP
            </div>
          </div>
          <Mascot mood="party" size={64} crown={lvl.level >= 10} />
        </div>
      </div>

      <div class="grid2 mt">
        <div class="card center">
          <span class="streak-flame">🔥</span>
          <div class="bold" style={{ fontSize: 22 }}>
            {str} jour{str > 1 ? 's' : ''}
          </div>
          <div class="tiny muted">série actuelle · record {bestStreak(s.game.checkins)}</div>
        </div>
        <div class="card center">
          <span style={{ fontSize: 26 }}>🧘</span>
          <div class="bold" style={{ fontSize: 22 }}>
            {s.game.noSpendDays.length}
          </div>
          <div class="tiny muted">journées zen</div>
        </div>
      </div>

      <Challenges />

      <div class="section">
        <div class="section-title">
          <h2>🎨 Thèmes à débloquer</h2>
        </div>
        <div class="chips">
          {THEMES.map((t) => {
            const ok = lvl.level >= t.level
            return (
              <button
                class={`chip ${s.settings.theme === t.id ? 'on' : ''}`}
                style={{ opacity: ok ? 1 : 0.5 }}
                onClick={() => (ok ? update((x) => void (x.settings.theme = t.id), { silent: true }) : toast(`Débloqué au niveau ${t.level}`, '🔒'))}
              >
                {ok ? t.emoji : '🔒'} {t.name}
                {!ok && ` · niv. ${t.level}`}
              </button>
            )
          })}
        </div>
      </div>

      <div class="section">
        <div class="section-title">
          <h2>🏆 Succès</h2>
          <span class="small muted">
            {unlocked}/{ACHIEVEMENTS.length}
          </span>
        </div>
        <div class="trophies stagger">
          {ACHIEVEMENTS.map((a) => {
            const on = !!s.game.unlocked[a.id]
            const [cur, max] = a.progress(s)
            const hidden = a.secret && !on
            return (
              <div class={`trophy ${on ? 'unlocked' : 'locked'}`} key={a.id}>
                <span class="e">{hidden ? '❔' : a.emoji}</span>
                <b>{hidden ? 'Secret' : a.title}</b>
                <span>{hidden ? 'À découvrir…' : a.desc}</span>
                {!on && max > 1 && (
                  <span class="badge">
                    {cur}/{max}
                  </span>
                )}
                {on && <span class="badge good">+{a.xp} XP</span>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
