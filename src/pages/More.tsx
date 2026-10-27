import { state } from '../store/store'
import { computeInsights } from '../lib/insights'
import { levelOf } from '../lib/game'
import { go } from '../router'
import { Header } from '../components/ui'
import { vibrate } from '../lib/utils'

export function More() {
  const s = state.value
  const alerts = computeInsights(s).filter((i) => i.level === 'alert' || i.level === 'warn').length
  const reimb = s.transactions.filter((t) => t.reimb && ((t.reimb.secu && !t.reimb.secuAt) || (t.reimb.mutuelle && !t.reimb.mutuelleAt))).length
  const tiles: [string, string, string, number?][] = [
    ['🎯', 'Projets & objectifs', '/projects'],
    ['🎄', 'Noël', s.events.find((e) => e.kind === 'christmas' && !e.archived) ? `/event/${s.events.find((e) => e.kind === 'christmas' && !e.archived)!.id}` : '/projects'],
    ['🏖️', 'Vacances', s.events.find((e) => e.kind === 'trip' && !e.archived) ? `/event/${s.events.find((e) => e.kind === 'trip' && !e.archived)!.id}` : '/projects'],
    ['🩺', 'Santé & remb.', '/health', reimb],
    ['📊', 'Statistiques', '/stats'],
    ['🔮', 'Coach IA', '/coach', alerts],
    ['🏆', `Trophées · niv. ${levelOf(s.game.xp).level}`, '/trophies'],
    ['🔁', 'Récurrentes', '/recurring'],
    ['🏷️', 'Catégories', '/categories'],
    ['📥', 'Import CSV', '/import'],
    ['⚙️', 'Réglages', '/settings'],
  ]
  return (
    <div class="page">
      <Header title="Plus de choses" back={false} />
      <div class="tiles stagger">
        {tiles.map(([e, label, to, n]) => (
          <button class="tile" onClick={() => (vibrate(), go(to))}>
            <span class="e">{e}</span>
            <span>{label}</span>
            {!!n && <span class="n">{n}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
