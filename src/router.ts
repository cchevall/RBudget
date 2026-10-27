import { signal } from '@preact/signals'

function parse() {
  const raw = location.hash.replace(/^#/, '') || '/'
  const [path, qs] = raw.split('?')
  return { path: path || '/', query: new URLSearchParams(qs ?? '') }
}

export const route = signal(parse())
window.addEventListener('hashchange', () => {
  route.value = parse()
  window.scrollTo({ top: 0 })
})

export const go = (to: string) => (location.hash = to.startsWith('#') ? to : '#' + to)
