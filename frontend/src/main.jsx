import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './old/indexOld.css'
import App from './old/AppOld.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
