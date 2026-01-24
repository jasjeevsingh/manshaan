import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { HumeProvider } from './providers/HumeProvider.tsx'

const humeApiKey = import.meta.env.VITE_HUME_API_KEY || '';
const humeConfigId = import.meta.env.VITE_HUME_CONFIG_ID || '';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HumeProvider apiKey={humeApiKey} configId={humeConfigId}>
      <App />
    </HumeProvider>
  </StrictMode>,
)
