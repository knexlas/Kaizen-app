import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { GardenProvider } from './context/GardenContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <GardenProvider>
        <App />
      </GardenProvider>
    </ThemeProvider>
  </StrictMode>,
)
