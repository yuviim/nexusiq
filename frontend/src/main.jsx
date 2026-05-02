import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'

const msalConfig = {
  auth: {
    clientId:    import.meta.env.VITE_AZURE_CLIENT_ID,
    authority:   `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: import.meta.env.VITE_AZURE_REDIRECT_URI,
  },
  cache: {
    cacheLocation:       'sessionStorage',
    storeAuthStateInCookie: false,
  },
}

const msalInstance = new PublicClientApplication(msalConfig)

createRoot(document.getElementById('root')).render(
  <MsalProvider instance={msalInstance}>
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  </MsalProvider>
)