import { useState, useEffect, useCallback } from 'react'
import { PlusCircle, X } from 'lucide-react'
import { getConversations, deleteConversation } from '../api/chat'
import client from '../api/client'

const Toggle = ({ active, onToggle, disabled }) => (
  <button onClick={onToggle} disabled={disabled} style={{ width: 28, height: 16, borderRadius: 8, background: active ? '#2563eb' : '#d1d5db', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0, padding: 0, opacity: disabled ? 0.5 : 1 }}>
    <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: active ? 14 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
  </button>
)

export default function ChatSidebar({ sessionId, onNewSession, onSelectSession, sources, agentEnabled, onToggleAgent }) {
  const [conversations, setConversations] = useState([])
  const [hoveredConv,   setHoveredConv]   = useState(null)

  const loadConversations = useCallback(async () => {
    try { const res = await getConversations(); setConversations(res.data.conversations || []) } catch {}
  }, [])

  useEffect(() => { loadConversations() }, [sessionId, loadConversations])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    try { await deleteConversation(id); setConversations(prev => prev.filter(c => c.session_id !== id)) } catch {}
  }

  return (
    <aside style={{ width: 232, background: '#f9fafb', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', padding: '14px 12px', gap: 14, flexShrink: 0, overflow: 'hidden' }}>

      {/* New Chat */}
      <button onClick={onNewSession} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 14px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 9, color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#374151' }}
      >
        <PlusCircle size={15} strokeWidth={2} /> New Chat
      </button>

      {/* Data Sources */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Data Sources</div>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '4px 10px' }}>
          {[
            { key: 'sharepoint', label: 'SharePoint', color: '#0078d4' },
            { key: 'sql',        label: 'SQL MCP',    color: '#16a34a' },
          ].map((item, i) => (
            <div key={item.key}>
              {i > 0 && <div style={{ height: 1, background: '#f3f4f6' }} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 0' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: sources[item.key] && agentEnabled[item.key] ? item.color : '#d1d5db', flexShrink: 0, boxShadow: sources[item.key] && agentEnabled[item.key] ? `0 0 0 2px ${item.color}20` : 'none' }} />
                <span style={{ fontSize: 12, color: '#374151', flex: 1, fontWeight: 500 }}>{item.label}</span>
                <Toggle active={agentEnabled[item.key]} onToggle={() => onToggleAgent(item.key)} disabled={!sources[item.key]} />
              </div>
            </div>
          ))}
          <div style={{ height: 1, background: '#f3f4f6' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 0' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: sources.chromadb ? '#7c3aed' : '#d1d5db', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#374151', flex: 1, fontWeight: 500 }}>ChromaDB RAG</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: sources.chromadb ? '#ede9fe' : '#f3f4f6', color: sources.chromadb ? '#6d28d9' : '#9ca3af' }}>
              {sources.chromadb ? 'live' : 'off'}
            </span>
          </div>
        </div>
      </div>

      {/* History */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>History</div>
        <div style={{ flex: 1, overflow: 'auto', marginRight: -4, paddingRight: 4 }}>
          {conversations.length === 0 ? (
            <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '16px 0', fontWeight: 500 }}>No conversations yet</div>
          ) : (
            conversations.map(conv => (
              <div key={conv.session_id}
                onClick={() => onSelectSession(conv.session_id)}
                onMouseEnter={() => setHoveredConv(conv.session_id)}
                onMouseLeave={() => setHoveredConv(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 8px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s', background: conv.session_id === sessionId ? 'white' : hoveredConv === conv.session_id ? 'white' : 'transparent', border: conv.session_id === sessionId ? '1px solid #e5e7eb' : '1px solid transparent', boxShadow: conv.session_id === sessionId ? '0 1px 2px rgba(0,0,0,0.04)' : 'none', marginBottom: 2 }}
              >
                <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: conv.session_id === sessionId ? '#2563eb' : '#d1d5db' }} />
                <span style={{ fontSize: 12, color: conv.session_id === sessionId ? '#111' : '#6b7280', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: conv.session_id === sessionId ? 600 : 500 }}>
                  {conv.title}
                </span>
                {hoveredConv === conv.session_id && (
                  <button onClick={e => handleDelete(e, conv.session_id)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 1, borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  )
}