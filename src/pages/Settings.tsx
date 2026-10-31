import { useEffect, useState } from 'preact/hooks'
import { replaceState, state, toast, update } from '../store/store'
import { defaultState } from '../store/defaults'
import type { AppState } from '../store/types'
import { levelOf, THEMES } from '../lib/game'
import { toCSV } from '../lib/csv'
import { download, sha256, today } from '../lib/utils'
import { ConfirmButton, Header, Seg, Sheet } from '../components/ui'
import { go } from '../router'

export function Settings() {
  const s = state.value
  const st = s.settings
  const set = (patch: Partial<AppState['settings']>) => update((x) => void Object.assign(x.settings, patch), { silent: true })
  const lvl = levelOf(s.game.xp).level
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [pinOpen, setPinOpen] = useState(false)
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {})
  }, [])

  const backup = async () => {
    const json = JSON.stringify(s)
    const name = `mochi-budget-${today()}.json`
    const file = new File([json], name, { type: 'application/json' })
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Sauvegarde Mochi Budget' })
      else download(name, json)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      download(name, json)
    }
    update((x) => void (x.settings.lastBackup = Date.now()))
    toast('Sauvegarde créée !', '💾')
  }

  const restore = async (f?: File) => {
    if (!f) return
    try {
      const data = JSON.parse(await f.text()) as AppState
      if (!data.transactions || !data.categories) throw new Error()
      replaceState(data)
      toast(`Restauré : ${data.transactions.length} opérations`, '✨')
    } catch {
      toast("Ce fichier n'est pas une sauvegarde valide", '😕')
    }
  }

  return (
    <div class="page">
      <Header title="Réglages" />

      <div class="card form">
        <h3>👋 Profil & budget</h3>
        <label class="field">
          <span>Prénom (pour Mochi)</span>
          <input class="input" value={st.name} onChange={(e) => set({ name: e.currentTarget.value.trim() })} />
        </label>
        <div class="field">
          <span>Profil</span>
          <Seg value={st.profile} onChange={(profile) => (set({ profile }), profile === 'ae' && go('/pro/settings'))} options={[['salarie', '💼 Salarié·e'], ['ae', '🧑‍💻 Auto-entrepreneur·e']]} />
        </div>
        {st.profile === 'ae' && (
          <button class="btn ghost block" onClick={() => go('/pro/settings')}>
            ⚙️ Réglages de mon activité
          </button>
        )}
        <label class="field">
          <span>Le mois budgétaire commence le…</span>
          <select class="input" value={st.monthStartDay} onChange={(e) => set({ monthStartDay: Number(e.currentTarget.value) })}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option value={d}>{d === 1 ? '1er (mois calendaire)' : `${d} du mois (ex : jour de paie)`}</option>
            ))}
          </select>
        </label>
        <label class="field">
          <span>Devise</span>
          <select class="input" value={st.currency} onChange={(e) => set({ currency: e.currentTarget.value })}>
            {['EUR', 'CHF', 'CAD', 'USD', 'GBP', 'XPF'].map((c) => (
              <option value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      <div class="card form">
        <h3>🎨 Apparence</h3>
        <div class="chips">
          {THEMES.map((t) => (
            <button class={`chip ${st.theme === t.id ? 'on' : ''}`} style={{ opacity: lvl >= t.level ? 1 : 0.45 }} onClick={() => (lvl >= t.level ? set({ theme: t.id }) : toast(`Débloqué au niveau ${t.level}`, '🔒'))}>
              {lvl >= t.level ? t.emoji : '🔒'} {t.name}
            </button>
          ))}
        </div>
        <Seg value={st.dark} onChange={(v) => set({ dark: v })} options={[['auto', '🌗 Auto'], ['light', '☀️ Clair'], ['dark', '🌙 Sombre']]} />
      </div>

      <div class="card form">
        <h3>🔐 Confidentialité</h3>
        <p class="small muted">Tes données restent uniquement sur ce téléphone. Aucun serveur, aucun compte.</p>
        <button class="btn ghost block" onClick={() => setPinOpen(true)}>
          {st.pinHash ? '🔑 Changer / retirer le code' : '🔒 Protéger avec un code'}
        </button>
      </div>

      <div class="card form">
        <h3>💾 Mes données</h3>
        <p class="small muted">
          {st.lastBackup ? `Dernière sauvegarde : ${new Date(st.lastBackup).toLocaleDateString('fr-FR')}` : 'Aucune sauvegarde pour le moment.'} Si tu changes de téléphone ou effaces Safari/Chrome, seule une sauvegarde te permettra de tout récupérer.
        </p>
        {persisted === false && <p class="small warn">⚠️ Le navigateur peut effacer les données s'il manque de place : installe l'app sur l'écran d'accueil et sauvegarde régulièrement.</p>}
        <button class="btn block" onClick={backup}>
          💾 Sauvegarder (fichier)
        </button>
        <label class="btn ghost block">
          📂 Restaurer une sauvegarde
          <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={(e) => restore(e.currentTarget.files?.[0])} />
        </label>
        <button class="btn ghost block" onClick={() => go('/import')}>
          📥 Importer un relevé bancaire (CSV)
        </button>
        <button class="btn ghost block" onClick={() => download(`mochi-operations-${today()}.csv`, toCSV(s, [...s.transactions].sort((a, b) => a.date.localeCompare(b.date))), 'text/csv')}>
          📤 Exporter en CSV (Excel)
        </button>
      </div>

      <div class="card form">
        <h3>📲 Installer l'app</h3>
        <p class="small muted">
          <b>iPhone</b> : dans Safari, bouton Partager → « Sur l'écran d'accueil ».
          <br />
          <b>Android</b> : menu ⋮ de Chrome → « Installer l'application ».
          <br />
          Une fois installée, elle marche même hors connexion ✈️
        </p>
      </div>

      <div class="card form">
        <h3>🧨 Zone sensible</h3>
        <ConfirmButton
          label="Tout effacer et recommencer"
          confirmLabel="Vraiment tout effacer ? Appuie encore"
          onConfirm={() => {
            replaceState(defaultState())
            go('/')
          }}
        />
      </div>
      <p class="tiny faint center mt">Mochi Budget · fait avec 💕 · v{__APP_VERSION__}</p>

      <Sheet open={pinOpen} onClose={() => setPinOpen(false)} title="Code de verrouillage">
        {pinOpen && <PinSetup onDone={() => setPinOpen(false)} />}
      </Sheet>
    </div>
  )
}

function PinSetup({ onDone }: { onDone: () => void }) {
  const [pin, setPin] = useState('')
  const has = !!state.value.settings.pinHash
  return (
    <div class="form">
      <p class="small muted">4 chiffres demandés à chaque ouverture. ⚠️ Si tu l'oublies, il faudra effacer les données du site (garde une sauvegarde !).</p>
      <input class="input center" style={{ fontSize: 28, letterSpacing: 12 }} inputMode="numeric" maxLength={4} value={pin} onInput={(e) => setPin(e.currentTarget.value.replace(/\D/g, '').slice(0, 4))} placeholder="••••" />
      <button
        class="btn block"
        disabled={pin.length !== 4}
        onClick={async () => {
          const h = await sha256('mochi:' + pin)
          update((x) => void (x.settings.pinHash = h), { silent: true })
          sessionStorage.setItem('mochi-unlocked', '1')
          toast('Code activé', '🔒')
          onDone()
        }}
      >
        Enregistrer le code
      </button>
      {has && (
        <button
          class="btn danger block"
          onClick={() => {
            update((x) => void (x.settings.pinHash = undefined), { silent: true })
            toast('Code retiré', '🔓')
            onDone()
          }}
        >
          Retirer le code
        </button>
      )}
    </div>
  )
}
