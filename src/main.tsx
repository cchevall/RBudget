import { render } from 'preact'
import '@fontsource/fredoka/latin-400.css'
import '@fontsource/fredoka/latin-500.css'
import '@fontsource/fredoka/latin-600.css'
import '@fontsource/fredoka/latin-700.css'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app'
import { load } from './store/store'

registerSW({ immediate: true })
load()
render(<App />, document.getElementById('app')!)
