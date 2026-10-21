import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { OrbGallery } from './components/OrbGallery.tsx'

const showGallery = new URLSearchParams(window.location.search).has('orbs')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{showGallery ? <OrbGallery /> : <App />}</StrictMode>,
)
