import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AgentApp from './AgentApp.tsx'
import { pageForSearch } from './lib/page.ts'

const page = pageForSearch(window.location.search)

createRoot(document.getElementById('root')!).render(
  <StrictMode>{page === 'agent' ? <AgentApp /> : <App />}</StrictMode>,
)
