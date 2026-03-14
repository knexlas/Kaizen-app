import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/accessibility.css'
import App from './App.jsx'
import { GardenProvider } from './context/GardenContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { RewardProvider } from './context/RewardContext.jsx'
import { DialogProvider } from './context/DialogContext.jsx'
import RewardOverlay from './components/Rewards/RewardOverlay.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <GardenProvider>
          <RewardProvider>
            <DialogProvider>
              <App />
              <RewardOverlay />
            </DialogProvider>
          </RewardProvider>
        </GardenProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
