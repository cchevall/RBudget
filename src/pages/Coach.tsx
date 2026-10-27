import { useEffect, useMemo, useState } from 'preact/hooks'
import { saveRecurring, state, toast, update } from '../store/store'
import { computeInsights, type Insight } from '../lib/insights'
import { buildPrompt, DEFAULT_PROMPT_OPTIONS, type PromptOptions } from '../lib/prompt'
import { addMonths } from '../lib/utils'
import { Empty, Header, Seg, ToggleRow } from '../components/ui'
import { Mascot } from '../components/Mascot'
import { go } from '../router'

export function Coach() {
  const s = state.value
  const insights = useMemo(() => computeInsights(s), [s])
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('mochi-dismissed') ?? '[]')
    } catch {
      return []
    }
  })
  const visible = insights.filter((i) => !dismissed.includes(i.id))
  const [o, setO] = useState<PromptOptions>(DEFAULT_PROMPT_OPTIONS)
  const [show, setShow] = useState(false)
  const prompt = useMemo(() => (show ? buildPrompt(s, o) : ''), [show, o, s])

  useEffect(() => {
    if (!s.game.flags.detective) update((x) => void (x.game.flags.detective = Date.now()))
  }, [])

  const dismiss = (id: string) => {
    const next = [...dismissed, id]
    setDismissed(next)
    try {
      localStorage.setItem('mochi-dismissed', JSON.stringify(next))
    } catch {}
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      toast('Prompt copié ! Colle-le dans ton IA préférée', '📋')
    } catch {
      toast('Copie impossible, sélectionne le texte à la main', '😕')
    }
    if (!s.game.flags.ai) update((x) => void (x.game.flags.ai = Date.now()))
  }
  const share = async () => {
    try {
      await navigator.share({ title: 'Analyse de mon budget', text: prompt })
      if (!s.game.flags.ai) update((x) => void (x.game.flags.ai = Date.now()))
    } catch {}
  }

  const fix = (i: Insight) => {
    if (i.fix?.kind === 'recurring') {
      saveRecurring({ label: i.fix.label, amount: i.fix.amount, categoryId: i.fix.categoryId, type: 'expense', frequency: 'monthly', startDate: addMonths(i.fix.date, 1), autoPost: true })
      toast('Ajouté aux récurrentes, plus besoin de le saisir !', '🤖')
      dismiss(i.id)
    }
  }

  return (
    <div class="page">
      <Header title="Coach & détective" />

      <div class="row" style={{ gap: 12 }}>
        <Mascot mood={visible.some((i) => i.level === 'alert') ? 'worried' : 'happy'} size={74} />
        <div class="speech small grow">{visible.length ? `J'ai fouiné dans tes comptes : ${visible.length} chose${visible.length > 1 ? 's' : ''} à regarder 🕵️` : 'Rien de louche à signaler, tout roule ! 🌈'}</div>
      </div>

      <div class="section">
        <div class="section-title">
          <h2>🕵️ Ce que j'ai repéré</h2>
          {dismissed.length > 0 && (
            <button
              onClick={() => {
                setDismissed([])
                localStorage.removeItem('mochi-dismissed')
              }}
            >
              Tout réafficher
            </button>
          )}
        </div>
        {visible.length === 0 ? (
          <div class="card">
            <Empty emoji="🌈" title="Rien de louche" text="Plus tu notes de dépenses, plus je repère de choses (doublons, hausses de prix, abonnements oubliés…)." />
          </div>
        ) : (
          <div class="stagger">
            {visible.map((i) => (
              <div class={`insight ${i.level}`} key={i.id}>
                <span class="e">{i.emoji}</span>
                <div class="grow">
                  <b>{i.title}</b>
                  <p class="small" style={{ marginTop: 2 }}>
                    {i.text}
                  </p>
                  <div class="row wrap gap-s mt" style={{ marginTop: 8 }}>
                    {i.fix && (
                      <button class="btn sm" onClick={() => fix(i)}>
                        Oui, ajoute-le
                      </button>
                    )}
                    {i.route && (
                      <button class="btn sm white" onClick={() => go(i.route!.slice(1))}>
                        Voir
                      </button>
                    )}
                    <button class="btn sm ghost" onClick={() => dismiss(i.id)}>
                      C'est normal
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div class="section">
        <div class="section-title">
          <h2>🔮 Prompt pour ton IA</h2>
        </div>
        <div class="card">
          <p class="small muted">Génère un prompt complet avec tes données à coller dans ChatGPT, Claude, Gemini, Le Chat… pour obtenir des recommandations et repérer les trucs louches. Rien n'est envoyé par l'app : c'est toi qui copies.</p>
          <div class="form mt">
            <div class="field">
              <span>Période analysée</span>
              <Seg value={String(o.months)} onChange={(v) => setO({ ...o, months: Number(v) })} options={[['1', '1 mois'], ['3', '3 mois'], ['6', '6 mois'], ['12', '1 an']]} />
            </div>
            <ToggleRow label="Détail de chaque opération" hint="Plus précis, mais prompt plus long" on={o.details} onChange={(v) => setO({ ...o, details: v })} />
            <ToggleRow label="Anonymiser les libellés" hint="Remplace les noms de marchands par « Marchand 1, 2… »" on={o.anonymize} onChange={(v) => setO({ ...o, anonymize: v })} />
            <div class="field">
              <span>Ce que tu veux</span>
              <div class="chips wrap" style={{ flexWrap: 'wrap' }}>
                {(
                  [
                    ['suspicious', '🕵️ Trucs louches'],
                    ['savings', '💡 Économies'],
                    ['subscriptions', '🔁 Abonnements'],
                    ['projects', '🎯 Projets'],
                    ['kids', '👶 Aides & droits'],
                  ] as const
                ).map(([k, l]) => (
                  <button class={`chip ${o.focus[k] ? 'on' : ''}`} onClick={() => setO({ ...o, focus: { ...o.focus, [k]: !o.focus[k] } })}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <label class="field">
              <span>Une question en particulier ? (optionnel)</span>
              <textarea class="input" placeholder="Ex : comment financer les vacances de juillet sans toucher à l'épargne ?" value={o.question} onInput={(e) => setO({ ...o, question: e.currentTarget.value })} />
            </label>
            <button class="btn block" onClick={() => setShow(true)}>
              🔮 Générer le prompt
            </button>
          </div>
          {show && (
            <div class="mt" style={{ animation: 'pop-in .4s var(--spring)' }}>
              <div class="prompt-box">{prompt}</div>
              <div class="tiny muted mt">{prompt.length.toLocaleString('fr-FR')} caractères</div>
              <div class="row mt">
                <button class="btn grow" onClick={copy}>
                  📋 Copier
                </button>
                {'share' in navigator && (
                  <button class="btn ghost grow" onClick={share}>
                    📤 Partager
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
