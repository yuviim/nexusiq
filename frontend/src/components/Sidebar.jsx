import { useState, useEffect, useCallback } from 'react'
import { getSourceStatus, getConversations, deleteConversation } from '../api/chat'
import client from '../api/client'

const Toggle = ({ active, onToggle, disabled }) => (
  <button onClick={onToggle} disabled={disabled} style={{ width: 32, height: 18, borderRadius: 9, background: active ? 'var(--accent)' : '#d1d5db', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0, padding: 0, opacity: disabled ? 0.5 : 1 }}>
    <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: active ? 16 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
  </button>
)

const SourceRow = ({ active, enabled, label, color, onToggle, canToggle }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0' }}>
    <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: active && enabled ? color : '#d1d5db', boxShadow: active && enabled ? `0 0 0 2px ${color}20` : 'none', transition: 'all 0.3s' }} />
    <span style={{ fontSize: 12, color: active && enabled ? 'var(--text-secondary)' : 'var(--text-muted)', flex: 1 }}>{label}</span>
    {canToggle ? (
      <Toggle active={enabled} onToggle={onToggle} disabled={!active} />
    ) : (
      <span style={{ fontSize: 10, fontWeight: 500, color: active ? color : 'var(--text-muted)', background: active ? `${color}10` : 'var(--bg-hover)', padding: '2px 6px', borderRadius: 4 }}>
        {active ? 'live' : 'off'}
      </span>
    )}
  </div>
)

const NavBtn = ({ onClick, accentColor, children }) => (
  <button
    onClick={onClick}
    style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: 'var(--shadow-sm)' }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.color = accentColor }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
  >
    {children}
  </button>
)

export default function Sidebar({ sessionId, user, onNewSession, onShowUpload, onShowBulkUpload, onShowDocuments, onLogout, onSelectSession, onShowSettings }) {
  const [sources,       setSources]       = useState({})
  const [conversations, setConversations] = useState([])
  const [hoveredConv,   setHoveredConv]   = useState(null)
  const [spEnabled,     setSpEnabled]     = useState(true)
  const [sqlEnabled,    setSqlEnabled]    = useState(true)

  const loadConversations = useCallback(async () => {
    try { const res = await getConversations(); setConversations(res.data.conversations || []) } catch {}
  }, [])

  useEffect(() => {
    const checkSources = async () => { try { const r = await getSourceStatus(); setSources(r.data) } catch {} }
    checkSources()
    loadConversations()
    const id = setInterval(checkSources, 30000)
    return () => clearInterval(id)
  }, [loadConversations])

  useEffect(() => { loadConversations() }, [sessionId, loadConversations])

  const handleDelete = async (e, convSessionId) => {
    e.stopPropagation()
    try {
      await deleteConversation(convSessionId)
      setConversations(prev => prev.filter(c => c.session_id !== convSessionId))
    } catch {}
  }

  const handleToggleSP  = async () => { const next = !spEnabled;  setSpEnabled(next);  try { await client.post('/agents/toggle', { agent: 'sharepoint', enabled: next }) } catch {} }
  const handleToggleSQL = async () => { const next = !sqlEnabled; setSqlEnabled(next); try { await client.post('/agents/toggle', { agent: 'sql',        enabled: next }) } catch {} }

  return (
    <aside style={{ width: 248, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '20px 16px', gap: 16, flexShrink: 0, overflow: 'hidden' }}>

      {/* Logo */}
      <div style={{ padding: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'white', boxShadow: '0 2px 8px rgba(37,99,235,0.25)', flexShrink: 0 }}>N</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.4px', color: 'var(--text-primary)' }}>Nexus<span style={{ color: 'var(--accent)' }}>IQ</span></div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>Enterprise Knowledge Assistant</div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <NavBtn onClick={onNewSession} accentColor="var(--accent)">
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New Session
        </NavBtn>

        <NavBtn onClick={onShowUpload} accentColor="var(--sql-color)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
          </svg>
          Upload Data
        </NavBtn>

        <NavBtn onClick={onShowBulkUpload} accentColor="var(--rag-color)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Bulk Upload
        </NavBtn>

        <NavBtn onClick={onShowDocuments} accentColor="var(--sp-color)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          Knowledge Base
        </NavBtn>

        <NavBtn onClick={onShowSettings} accentColor="var(--text-secondary)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Connections
        </NavBtn>
      </div>

      {/* Data Sources */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>Data Sources</div>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 12px', boxShadow: 'var(--shadow-sm)' }}>
          <SourceRow active={sources.sharepoint} enabled={spEnabled}  label="SharePoint MCP" color="var(--sp-color)"  canToggle onToggle={handleToggleSP} />
          <div style={{ height: 1, background: 'var(--border-light)' }} />
          <SourceRow active={sources.sql}        enabled={sqlEnabled} label="SQL MCP"        color="var(--sql-color)" canToggle onToggle={handleToggleSQL} />
          <div style={{ height: 1, background: 'var(--border-light)' }} />
          <SourceRow active={sources.chromadb}   enabled={true}       label="ChromaDB RAG"   color="var(--rag-color)" canToggle={false} />
        </div>
      </div>

      {/* Chat History */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>History</div>
        <div style={{ flex: 1, overflow: 'auto', marginRight: -4, paddingRight: 4 }}>
          {conversations.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>No conversations yet</div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.session_id}
                onClick={() => onSelectSession && onSelectSession(conv.session_id)}
                onMouseEnter={() => setHoveredConv(conv.session_id)}
                onMouseLeave={() => setHoveredConv(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s', background: conv.session_id === sessionId ? 'white' : hoveredConv === conv.session_id ? 'white' : 'transparent', border: conv.session_id === sessionId ? '1px solid var(--border)' : '1px solid transparent', boxShadow: conv.session_id === sessionId ? 'var(--shadow-sm)' : 'none', marginBottom: 2 }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: conv.session_id === sessionId ? 'var(--accent)' : 'var(--border)' }} />
                <span style={{ fontSize: 12, color: conv.session_id === sessionId ? 'var(--text-primary)' : 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: conv.session_id === sessionId ? 500 : 400 }}>
                  {conv.title}
                </span>
                {hoveredConv === conv.session_id && (
                  <button onClick={e => handleDelete(e, conv.session_id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', borderRadius: 4, flexShrink: 0, fontSize: 14, lineHeight: 1 }} onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>×</button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* User + Logout */}
      <div>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white' }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || 'User'}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{user?.username || ''}</div>
          </div>
          <button onClick={onLogout} title="Sign out" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: 4, transition: 'color 0.15s', display: 'flex', alignItems: 'center' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>NexusIQ v1.0</div>
      </div>
    </aside>
  )
}