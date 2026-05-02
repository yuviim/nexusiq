import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext'
import { useToast } from './context/ToastContext'
import TopNav from './components/TopNav'
import ChatSidebar from './components/ChatSidebar'
import ChatPage from './pages/ChatPage'
import DashboardPage from './pages/DashboardPage'
import DataPage from './pages/DataPage'
import DocumentsPage from './pages/DocumentsPage'
import SettingsPage from './pages/SettingsPage'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import OnboardingWizard from './pages/OnboardingWizard'
import { newSession, getHistory, getSourceStatus } from './api/chat'
import client from './api/client'

export default function App() {
  const { user, logout, loading } = useAuth()
  const toast = useToast()

  const [activeTab,       setActiveTab]       = useState('home')
  const [sessionId,       setSessionId]       = useState(() => localStorage.getItem('nexusiq_session') || null)
  const [sessionMessages, setSessionMessages] = useState([])
  const [pendingQuery,    setPendingQuery]     = useState(null)
  const [sources,         setSources]         = useState({})
  const [agentEnabled,    setAgentEnabled]    = useState({ sharepoint: true, sql: true, rag: true })
  const [onboarded,       setOnboarded]       = useState(
    () => localStorage.getItem('nexusiq_onboarded') === 'true'
  )

  useEffect(() => {
    const loadSources = async () => {
      try { const r = await getSourceStatus(); setSources(r.data) } catch {}
    }
    loadSources()
    const id = setInterval(loadSources, 30000)
    return () => clearInterval(id)
  }, [])

  if (loading) return null

  const isLanding = window.location.pathname === '/'
  if (window.location.hash === '#landing') return <LandingPage />
  if (!user) return <LoginPage />
  if (!onboarded) return <OnboardingWizard onComplete={() => setOnboarded(true)} />

  const handleNewSession = async (query = null) => {
    try {
      const res = await newSession()
      const id  = res.data.session_id
      setSessionId(id)
      setSessionMessages([])
      localStorage.setItem('nexusiq_session', id)
      if (query) setPendingQuery(query)
    } catch {
      const id = crypto.randomUUID()
      setSessionId(id)
      setSessionMessages([])
      localStorage.setItem('nexusiq_session', id)
      if (query) setPendingQuery(query)
    }
  }

  const handleSelectSession = async (id) => {
    try {
      const res = await getHistory(id)
      setSessionId(id)
      setSessionMessages(res.data.messages || [])
      localStorage.setItem('nexusiq_session', id)
    } catch {
      toast.error('Could not load conversation')
    }
  }

  const handleLogout = async () => {
    await logout()
    toast.success('Signed out successfully')
  }

  const handleToggleAgent = async (agent) => {
    const next = { ...agentEnabled, [agent]: !agentEnabled[agent] }
    setAgentEnabled(next)
    try { await client.post('/agents/toggle', { agent, enabled: next[agent] }) } catch {}
  }

  const handleNewChat = async (query = null) => {
    await handleNewSession(query)
    setActiveTab('chat')
  }

  if (!sessionId) {
    handleNewSession()
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top Navigation */}
      <TopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={user}
        onLogout={handleLogout}
      />

      {/* Page Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {activeTab === 'home' && (
          <DashboardPage
            user={user}
            onTabChange={setActiveTab}
            onNewChat={handleNewChat}
            onSelectSession={handleSelectSession}
          />
        )}

        {activeTab === 'chat' && (
          <>
            <ChatSidebar
              sessionId={sessionId}
              sources={sources}
              agentEnabled={agentEnabled}
              onNewSession={() => handleNewSession()}
              onSelectSession={handleSelectSession}
              onToggleAgent={handleToggleAgent}
            />
            <ChatPage
              sessionId={sessionId}
              user={user}
              initialMessages={sessionMessages}
              pendingQuery={pendingQuery}
              onPendingQueryConsumed={() => setPendingQuery(null)}
            />
          </>
        )}

        {activeTab === 'data' && <DataPage />}

        {activeTab === 'knowledge' && <DocumentsPage />}

        {activeTab === 'settings' && <SettingsPage />}
      </div>
    </div>
  )
}