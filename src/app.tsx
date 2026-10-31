import { useEffect, useState } from 'preact/hooks'
import { loaded, runRecurrings, state } from './store/store'
import { route } from './router'
import { sha256, vibrate } from './lib/utils'
import { AddSheet, openAdd } from './components/AddSheet'
import { Celebrations, ConfettiListener, Toasts, XpFloat } from './components/ui'
import { Mascot } from './components/Mascot'
import { Home } from './pages/Home'
import { Transactions } from './pages/Transactions'
import { Envelopes } from './pages/Envelopes'
import { Projects } from './pages/Projects'
import { GoalPage } from './pages/Goal'
import { EventPage } from './pages/Event'
import { Health } from './pages/Health'
import { Stats } from './pages/Stats'
import { Coach } from './pages/Coach'
import { Trophies } from './pages/Trophies'
import { RecurringPage } from './pages/Recurring'
import { Categories } from './pages/Categories'
import { Import } from './pages/Import'
import { Settings } from './pages/Settings'
import { More } from './pages/More'
import { Onboarding } from './pages/Onboarding'
import { ProHome } from './pages/Pro'
import { ProExpenses, ProInvoices, ProUrssaf, ProYear } from './pages/ProLists'
import { ProSettingsPage } from './pages/ProSettings'
import { Immo } from './pages/Immo'
import { ProSheets } from './components/ProSheets'

function useTheme() {
  const { theme, dark } = state.value.settings
  const [sysDark, setSysDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const m = matchMedia('(prefers-color-scheme: dark)')
    const on = () => setSysDark(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  const isDark = dark === 'dark' || (dark === 'auto' && sysDark)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.dark = String(isDark)
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#fff6f9')
  }, [theme, isDark])
}

function Page() {
  const { path } = route.value
  const [, a, b] = path.split('/')
  switch (a) {
    case '':
      return <Home />
    case 'tx':
      return <Transactions />
    case 'envelopes':
      return <Envelopes />
    case 'projects':
      return <Projects />
    case 'goal':
      return <GoalPage id={b} key={b} />
    case 'event':
      return <EventPage id={b} key={b} />
    case 'health':
      return <Health />
    case 'stats':
      return <Stats />
    case 'coach':
      return <Coach />
    case 'trophies':
      return <Trophies />
    case 'recurring':
      return <RecurringPage />
    case 'categories':
      return <Categories />
    case 'import':
      return <Import />
    case 'settings':
      return <Settings />
    case 'more':
      return <More />
    case 'pro':
      return b === 'invoices' ? <ProInvoices /> : b === 'expenses' ? <ProExpenses /> : b === 'urssaf' ? <ProUrssaf /> : b === 'year' ? <ProYear /> : b === 'settings' ? <ProSettingsPage /> : <ProHome />
    case 'immo':
      return <Immo />
    default:
      return <Home />
  }
}

function Nav() {
  const p = route.value.path
  const ae = state.value.settings.profile === 'ae'
  const on = (prefixes: string[]) => prefixes.some((x) => (x === '/' ? p === '/' : p.startsWith(x)))
  const Link = ({ to, ico, label, match }: { to: string; ico: string; label: string; match: string[] }) => (
    <a href={'#' + to} class={on(match) ? 'on' : ''} onClick={() => vibrate(6)}>
      <span class="ico">{ico}</span>
      {label}
    </a>
  )
  return (
    <nav class="nav">
      <Link to="/" ico="🏡" label="Accueil" match={['/']} />
      {ae ? <Link to="/pro" ico="💼" label="Pro" match={['/pro']} /> : <Link to="/tx" ico="🧾" label="Opés" match={['/tx']} />}
      <button class="fab" onClick={() => (vibrate(15), openAdd())} aria-label="Ajouter">
        ＋
      </button>
      <Link to="/envelopes" ico="✉️" label="Budgets" match={['/envelopes']} />
      <Link to="/more" ico="🌸" label="Plus" match={['/more', ...(ae ? ['/tx'] : []), '/immo', '/projects', '/goal', '/event', '/health', '/stats', '/coach', '/trophies', '/recurring', '/categories', '/import', '/settings']} />
    </nav>
  )
}

function Lock({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const press = async (k: string) => {
    vibrate(8)
    if (k === '⌫') return setPin(pin.slice(0, -1))
    const next = (pin + k).slice(0, 4)
    setPin(next)
    if (next.length === 4) {
      if ((await sha256('mochi:' + next)) === state.value.settings.pinHash) {
        sessionStorage.setItem('mochi-unlocked', '1')
        onUnlock()
      } else {
        vibrate([30, 40, 30])
        setShake(true)
        setTimeout(() => (setShake(false), setPin('')), 450)
      }
    }
  }
  return (
    <div class="fullscreen">
      <Mascot mood="sleepy" size={120} />
      <h2>Chut, c'est privé 🤫</h2>
      <div class={`pin-dots ${shake ? 'shake' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <i class={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      <div class="keypad" style={{ width: 260 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) => (k ? <button onClick={() => press(k)}>{k}</button> : <span />))}
      </div>
    </div>
  )
}

export function App() {
  useTheme()
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('mochi-unlocked') === '1')
  // New day while the app stays open in background: generate due recurrings
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && loaded.value && runRecurrings()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  if (!loaded.value)
    return (
      <div class="fullscreen">
        <Mascot size={110} />
      </div>
    )
  const s = state.value
  if (s.settings.pinHash && !unlocked) return <Lock onUnlock={() => setUnlocked(true)} />
  if (!s.settings.onboarded)
    return (
      <>
        <Onboarding />
        <Toasts />
        <ConfettiListener />
      </>
    )
  return (
    <>
      <Page />
      <Nav />
      <AddSheet />
      <ProSheets />
      <Toasts />
      <XpFloat />
      <Celebrations />
      <ConfettiListener />
    </>
  )
}
