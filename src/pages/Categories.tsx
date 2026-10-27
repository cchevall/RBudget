import { useState } from 'preact/hooks'
import { saveCategory, state } from '../store/store'
import type { Category, TxType } from '../store/types'
import { Bubble, Header, Seg, Sheet, ToggleRow } from '../components/ui'
import { ColorPicker, PASTELS } from '../components/common'

export function Categories() {
  const s = state.value
  const [kind, setKind] = useState<TxType>('expense')
  const [edit, setEdit] = useState<Partial<Category> | null>(null)
  const cats = s.categories.filter((c) => c.kind === kind)
  const tops = cats.filter((c) => !c.parentId)
  return (
    <div class="page">
      <Header title="Catégories" right={<button class="icon-btn" onClick={() => setEdit({ kind })}>＋</button>} />
      <Seg value={kind} onChange={setKind} options={[['expense', 'Dépenses'], ['income', 'Revenus']]} />
      <div class="col mt">
        {tops.map((t) => {
          const kids = cats.filter((c) => c.parentId === t.id)
          return (
            <div class="card" style={{ padding: '6px 14px', opacity: t.archived ? 0.5 : 1 }} key={t.id}>
              <button class="item" onClick={() => setEdit(t)}>
                <Bubble emoji={t.emoji} color={t.color} />
                <b class="grow">{t.name}</b>
                {t.archived && <span class="badge">archivée</span>}
                <span class="faint">✏️</span>
              </button>
              {kids.map((k) => (
                <button class="item" style={{ paddingLeft: 26, opacity: k.archived ? 0.5 : 1 }} onClick={() => setEdit(k)}>
                  <Bubble emoji={k.emoji} color={k.color} size="sm" />
                  <span class="grow">{k.name}</span>
                  <span class="faint">✏️</span>
                </button>
              ))}
              <button class="item small" style={{ paddingLeft: 26, color: 'var(--accent-deep)' }} onClick={() => setEdit({ kind, parentId: t.id, color: t.color })}>
                ＋ Sous-catégorie
              </button>
            </div>
          )
        })}
      </div>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Modifier la catégorie' : 'Nouvelle catégorie'}>
        {edit && <CatForm key={edit.id ?? 'new'} initial={edit} onDone={() => setEdit(null)} />}
      </Sheet>
    </div>
  )
}

function CatForm({ initial, onDone }: { initial: Partial<Category>; onDone: () => void }) {
  const [name, setName] = useState(initial.name ?? '')
  const [emoji, setEmoji] = useState(initial.emoji ?? '✨')
  const [color, setColor] = useState(initial.color ?? PASTELS[0])
  const [archived, setArchived] = useState(!!initial.archived)
  const parent = initial.parentId && state.value.categories.find((c) => c.id === initial.parentId)
  return (
    <div class="form">
      {parent && <div class="small muted">Dans {parent.emoji} {parent.name}</div>}
      <div class="row">
        <input class="input" style={{ width: 70, textAlign: 'center', fontSize: 26 }} value={emoji} onInput={(e) => setEmoji([...new Intl.Segmenter().segment(e.currentTarget.value)].pop()?.segment || '✨')} aria-label="Emoji" />
        <input class="input grow" placeholder="Nom" value={name} onInput={(e) => setName(e.currentTarget.value)} />
      </div>
      <p class="tiny muted">Astuce : tape dans la case emoji avec le clavier emoji 😊</p>
      <ColorPicker value={color} onChange={setColor} />
      {initial.id && <ToggleRow label="Archiver" hint="Masquée lors de la saisie, l'historique est conservé" on={archived} onChange={setArchived} />}
      <button
        class="btn block"
        disabled={!name.trim()}
        onClick={() => {
          saveCategory({ ...initial, kind: initial.kind ?? 'expense', name: name.trim(), emoji, color, archived })
          onDone()
        }}
      >
        Enregistrer
      </button>
    </div>
  )
}
