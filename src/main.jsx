import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/accessibility.css'
import App from './App.jsx'
import { GardenProvider } from './context/GardenContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { RewardProvider } from './context/RewardContext.jsx'
import RewardOverlay from './components/Rewards/RewardOverlay.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <GardenProvider>
        <RewardProvider>
          <App />
          <RewardOverlay />
        </RewardProvider>
      </GardenProvider>
    </ThemeProvider>
  </StrictMode>,
)
