import { createContext, useContext, useState, useEffect } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { login as apiLogin, logout as apiLogout } from '../api/chat'

const AuthContext = createContext(null)

const GRAPH_SCOPES = ['User.Read']

export function AuthProvider({ children }) {
  const { instance, accounts } = useMsal()
  const isMsalAuthenticated    = useIsAuthenticated()

  const [user, setUser]       = useState(null)
  const [token, setToken]     = useState(null)
  const [loading, setLoading] = useState(true)

  // ── Restore demo session from localStorage ──────────────────────────────
  useEffect(() => {
    const storedToken = localStorage.getItem('nexusiq_token')
    const storedUser  = localStorage.getItem('nexusiq_user')
    if (storedToken && storedUser) {
      setToken(storedToken)
      setUser(JSON.parse(storedUser))
    }
    setLoading(false)
  }, [])

  // ── Handle redirect response from Azure AD ───────────────────────────────
  useEffect(() => {
    instance.handleRedirectPromise().then(response => {
      if (response && response.account) {
        const account  = response.account
        const msalUser = {
          username: account.username,
          name:     account.name || account.username,
          source:   'msal',
        }
        setUser(msalUser)
        setLoading(false)
        instance.acquireTokenSilent({
          scopes:  GRAPH_SCOPES,
          account: account,
        }).then(res => {
          setToken(res.accessToken)
          localStorage.setItem('nexusiq_token', res.accessToken)
          localStorage.setItem('nexusiq_user', JSON.stringify(msalUser))
        }).catch(() => {})
      }
    }).catch(() => {})
  }, [instance])

  // ── Sync MSAL account into user state ───────────────────────────────────
  useEffect(() => {
    if (isMsalAuthenticated && accounts.length > 0) {
      const account  = accounts[0]
      const msalUser = {
        username: account.username,
        name:     account.name || account.username,
        source:   'msal',
      }
      setUser(msalUser)
      setLoading(false)
      instance.acquireTokenSilent({
        scopes:  GRAPH_SCOPES,
        account: account,
      }).then(res => {
        setToken(res.accessToken)
        localStorage.setItem('nexusiq_token', res.accessToken)
        localStorage.setItem('nexusiq_user', JSON.stringify(msalUser))
      }).catch(() => {})
    }
  }, [isMsalAuthenticated, accounts, instance])

  // ── Microsoft SSO login ──────────────────────────────────────────────────
  const loginWithMicrosoft = async () => {
    await instance.loginRedirect({
      scopes: GRAPH_SCOPES,
    })
  }

  // ── Demo username/password login ─────────────────────────────────────────
  const login = async (username, password) => {
    const res     = await apiLogin(username, password)
    const data    = res.data
    const demoUser = {
      username: data.username,
      name:     data.name,
      source:   'demo',
    }
    setToken(data.token)
    setUser(demoUser)
    localStorage.setItem('nexusiq_token', data.token)
    localStorage.setItem('nexusiq_user', JSON.stringify(demoUser))
    return data
  }

  // ── Logout (handles both MSAL and demo) ──────────────────────────────────
  const logout = async () => {
    if (user?.source === 'msal') {
      localStorage.removeItem('nexusiq_token')
      localStorage.removeItem('nexusiq_user')
      localStorage.removeItem('nexusiq_session')
      setUser(null)
      setToken(null)
      await instance.logoutRedirect()
    } else {
      if (token) await apiLogout(token).catch(() => {})
      setToken(null)
      setUser(null)
      localStorage.removeItem('nexusiq_token')
      localStorage.removeItem('nexusiq_user')
      localStorage.removeItem('nexusiq_session')
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, login, loginWithMicrosoft, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)