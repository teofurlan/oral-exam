import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AgentApp from './AgentApp.tsx'
import { pageForSearch } from './lib/page.ts'
import { hydratePreferences } from './lib/preferences.ts'
import { SHARED_PREFERENCE_KEYS } from './lib/storage.ts'

const page = pageForSearch(window.location.search)

// The shared preferences must be in localStorage before any component reads them (#27).
void hydratePreferences(SHARED_PREFERENCE_KEYS).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>{page === 'agent' ? <AgentApp /> : <App />}</StrictMode>,
  )
})
