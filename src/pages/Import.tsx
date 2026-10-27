import { useMemo, useState } from 'preact/hooks'
import { cat, state, toast, update, fireConfetti } from '../store/store'
import type { Transaction } from '../store/types'
import { guessMapping, isDuplicate, parseCSV, rowsToTransactions, type Mapping } from '../lib/csv'
import { learnRule, suggestCategories } from '../lib/autocat'
import { money, shortDate, uid } from '../lib/utils'
import { Bubble, Empty, Header } from '../components/ui'
import { CategorySelect } from '../components/common'

type Row = { date: string; label: string; amount: number; categoryId: string; dup: boolean; on: boolean }

export function Import() {
  const [rows, setRows] = useState<string[][] | null>(null)
  const [map, setMap] = useState<Mapping | null>(null)
  const [preview, setPreview] = useState<Row[] | null>(null)
  const [editing, setEditing] = useState<number | null>(null)

  const onFile = async (f?: File) => {
    if (!f) return
    let text = await f.text()
    // Many French banks still export in Latin-1
    if (text.includes('�')) text = new TextDecoder('windows-1252').decode(await f.arrayBuffer())
    const r = parseCSV(text)
    if (r.length < 2) return toast('Fichier vide ou illisible', '😕')
    setRows(r)
    setMap(guessMapping(r))
    setPreview(null)
  }

  const build = () => {
    if (!rows || !map) return
    const s = state.value
    const parsed = rowsToTransactions(rows, map)
    if (!parsed.length) return toast("Aucune ligne reconnue, vérifie les colonnes", '🤔')
    setPreview(
      parsed.map((p) => {
        const type = p.amount > 0 ? 'income' : 'expense'
        const guess = suggestCategories(s, p.label).find((id) => cat(id).kind === type) ?? (type === 'income' ? 'autres-revenus' : 'divers')
        const dup = isDuplicate(s, p)
        return { ...p, categoryId: guess, dup, on: !dup }
      }),
    )
  }

  const doImport = () => {
    if (!preview) return
    const chosen = preview.filter((r) => r.on)
    update((s) => {
      for (const r of chosen) {
        const tx: Transaction = { id: uid(), type: r.amount > 0 ? 'income' : 'expense', amount: Math.abs(r.amount), date: r.date, categoryId: r.categoryId, label: r.label, imported: true, createdAt: Date.now() }
        s.transactions.push(tx)
        learnRule(s, r.label, r.categoryId)
      }
      s.game.flags.csv = Date.now()
      s.game.xp += Math.min(100, chosen.length)
    })
    fireConfetti()
    toast(`${chosen.length} opérations importées !`, '📥')
    history.back()
  }

  const headers = rows?.[0] ?? []
  const colSelect = (key: keyof Mapping, label: string, optional = false) => (
    <label class="field">
      <span>{label}</span>
      <select class="input" value={String(map![key])} onChange={(e) => setMap({ ...map!, [key]: Number(e.currentTarget.value) })}>
        {optional && <option value="-1">— aucune —</option>}
        {headers.map((h, i) => (
          <option value={i}>{map!.headerRow ? h : `Colonne ${i + 1} (${h.slice(0, 20)})`}</option>
        ))}
      </select>
    </label>
  )
  const stats = useMemo(() => (preview ? { n: preview.filter((r) => r.on).length, dup: preview.filter((r) => r.dup).length } : null), [preview])

  return (
    <div class="page">
      <Header title="Importer un relevé" />
      {!rows && (
        <div class="card">
          <Empty emoji="📥" title="Importe le CSV de ta banque" text="Depuis l'appli ou le site de ta banque, exporte tes opérations en CSV, puis choisis le fichier ici. Je devine les catégories et j'ignore les doublons.">
            <label class="btn">
              📂 Choisir un fichier
              <input type="file" accept=".csv,text/csv,text/plain" style={{ display: 'none' }} onChange={(e) => onFile(e.currentTarget.files?.[0])} />
            </label>
          </Empty>
        </div>
      )}

      {rows && map && !preview && (
        <div class="card form">
          <h3>Quelles colonnes ?</h3>
          <p class="small muted">J'ai deviné, vérifie juste 😉</p>
          <label class="toggle-row">
            <div class="bold">La 1ʳᵉ ligne contient les titres</div>
            <button class={`switch ${map.headerRow ? 'on' : ''}`} onClick={() => setMap({ ...map, headerRow: !map.headerRow })} />
          </label>
          {colSelect('date', 'Date')}
          {colSelect('label', 'Libellé')}
          {colSelect('amount', 'Montant (signé)', true)}
          <div class="grid2">
            {colSelect('debit', 'Débit', true)}
            {colSelect('credit', 'Crédit', true)}
          </div>
          <button class="btn block" onClick={build}>
            Aperçu →
          </button>
        </div>
      )}

      {preview && stats && (
        <>
          <div class="card soft">
            <b>{stats.n} opérations à importer</b>
            {stats.dup > 0 && <div class="small muted">{stats.dup} déjà présentes (décochées)</div>}
            <div class="small muted">Touche une ligne pour changer sa catégorie.</div>
          </div>
          <div class="card mt">
            {preview.map((r, i) => (
              <div key={i}>
                <div class="item" style={{ opacity: r.on ? 1 : 0.45 }}>
                  <button class={`check ${r.on ? 'on' : ''}`} onClick={() => setPreview(preview.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}>
                    {r.on ? '✓' : ''}
                  </button>
                  <button class="row grow" style={{ textAlign: 'left', minWidth: 0 }} onClick={() => setEditing(editing === i ? null : i)}>
                    <Bubble emoji={cat(r.categoryId).emoji} color={cat(r.categoryId).color} size="sm" />
                    <div class="grow" style={{ minWidth: 0 }}>
                      <div class="small bold ellipsis">{r.label}</div>
                      <div class="tiny muted">
                        {shortDate(r.date)} · {cat(r.categoryId).name}
                        {r.dup && ' · doublon ?'}
                      </div>
                    </div>
                  </button>
                  <b class={`num small ${r.amount > 0 ? 'good' : ''}`}>{money(r.amount, { exact: true, sign: true })}</b>
                </div>
                {editing === i && (
                  <div style={{ padding: '0 0 10px' }}>
                    <CategorySelect
                      value={r.categoryId}
                      kind={r.amount > 0 ? 'income' : 'expense'}
                      onChange={(id) => {
                        // apply to every row with the same label start
                        const key = r.label.slice(0, 12)
                        setPreview(preview.map((x) => (x.label.slice(0, 12) === key ? { ...x, categoryId: id } : x)))
                        setEditing(null)
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <button class="btn block mt" disabled={!stats.n} onClick={doImport}>
            Importer {stats.n} opérations ✨
          </button>
          <button class="btn ghost block mt" onClick={() => setPreview(null)}>
            ← Revoir les colonnes
          </button>
        </>
      )}
    </div>
  )
}
