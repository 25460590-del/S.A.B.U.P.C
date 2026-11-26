import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { SesionProvider } from './context/SesionContext.tsx'
import { TemaProvider } from './context/TemaContext.tsx'
import './index.css'
import { iniciarControlPwaBeta } from './lib/pwaBeta.ts'

iniciarControlPwaBeta()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TemaProvider>
      <SesionProvider>
        <App />
      </SesionProvider>
    </TemaProvider>
  </StrictMode>,
)
