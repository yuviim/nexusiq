import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, FileText, Database, Download, AlertCircle, RefreshCw } from 'lucide-react'
import MessageBubble from '../components/MessageBubble'
import ChatInput from '../components/ChatInput'
import { SkeletonMessage } from '../components/Skeleton'
import { useToast } from '../context/ToastContext'
import { sendMessageStream, getSuggestions } from '../api/chat'
import client from '../api/client'

const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

const DB_ICONS = {
  mysql:      { icon: '🗄️', label: 'MySQL',      color: '#1d9e75' },
  snowflake:  { icon: '❄️', label: 'Snowflake',  color: '#0891b2' },
  databricks: { icon: '🧱', label: 'Databricks', color: '#ea580c' },
  postgresql: { icon: '🐘', label: 'PostgreSQL', color: '#336791' },
  exasol:     { icon: '⚡', label: 'Exasol',     color: '#6d28d9' },
  redshift:   { icon: '🔴', label: 'Redshift',   color: '#8c4fff' },
}

// Which agents were used — parsed from citations/result
const SourcePill = ({ icon, label, color, active }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '3px 10px', borderRadius: 20,
    background: active ? `${color}12` : '#f3f4f6',
    border: `1px solid ${active ? `${color}30` : '#e5e7eb'}`,
    transition: 'all 0.2s',
  }}>
    <span style={{ fontSize: 12 }}>{icon}</span>
    <span style={{ fontSize: 11, fontWeight: 600, color: active ? color : '#9ca3af' }}>{label}</span>
    <div style={{ width: 5, height: 5, borderRadius: '50%', background: active ? color : '#d1d5db', boxShadow: active ? `0 0 0 2px ${color}25` : 'none' }} />
  </div>
)

const ErrorBanner = ({ message, onRetry }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, margin: '0 0 16px' }}>
    <AlertCircle size={15} color="#ef4444" />
    <span style={{ fontSize: 13, color: '#dc2626', flex: 1, fontWeight: 500 }}>{message}</span>
    {onRetry && (
      <button onClick={onRetry} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#dc2626', fontWeight: 700, background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
        <RefreshCw size={11} /> Retry
      </button>
    )}
  </div>
)

// Export chat as text file
const exportChat = (messages, sessionId) => {
  const lines = [`NexusIQ Chat Export — Session ${sessionId?.slice(0, 8)}`, `Exported: ${new Date().toLocaleString()}`, '─'.repeat(60), '']
  messages.forEach(m => {
    if (m.role === 'user') {
      lines.push(`You: ${m.content}`)
    } else if (m.role === 'assistant') {
      lines.push(`NexusIQ: ${m.content}`)
      if (m.citations?.length) lines.push(`Sources: ${m.citations.map(c => c.title || c.source || 'Unknown').join(', ')}`)
    }
    lines.push('')
  })
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `nexusiq-chat-${new Date().toISOString().slice(0, 10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ChatPage({ sessionId, user, initialMessages = [], pendingQuery, onPendingQueryConsumed }) {
  const [messages,     setMessages]     = useState(initialMessages)
  const [loading,      setLoading]      = useState(false)
  const [streamingMsg, setStreamingMsg] = useState(null)
  const [statusText,   setStatusText]   = useState('')
  const [suggestions,  setSuggestions]  = useState([
    'Who are the top 5 sales reps?',
    'What is our remote work policy?',
    'Which departments are over budget?',
    'Show active projects',
  ])
  const [sources,      setSources]      = useState({})
  const [dbConfig,     setDbConfig]     = useState(null)
  const [error,        setError]        = useState(null)
  const [lastQuery,    setLastQuery]    = useState(null)
  const bottomRef  = useRef(null)
  const toast      = useToast()
  const pendingRef = useRef(false)

  useEffect(() => {
    getSuggestions().then(r => { if (r.data.suggestions?.length) setSuggestions(r.data.suggestions) }).catch(() => {})
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const [sr, dr] = await Promise.all([client.get('/sources/status'), client.get('/db/config')])
        setSources(sr.data || {})
        setDbConfig(dr.data?.connected ? dr.data : null)
      } catch {}
    }
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    setMessages(initialMessages || [])
    setStreamingMsg(null)
    setStatusText('')
    setError(null)
  }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingMsg])

  // Handle pending query from dashboard
  useEffect(() => {
    if (pendingQuery && !pendingRef.current) {
      pendingRef.current = true
      handleSend(pendingQuery)
      onPendingQueryConsumed?.()
    }
  }, [pendingQuery])

  useEffect(() => {
    if (!pendingQuery) pendingRef.current = false
  }, [pendingQuery])

  const handleSend = useCallback((query) => {
    if (loading) return
    setError(null)
    setLastQuery(query)
    setMessages(prev => [...prev, { role: 'user', content: query }])
    setLoading(true)
    setStreamingMsg({ role: 'assistant', content: '', streaming: true })
    setStatusText('Searching your data...')
    const startTime = Date.now()
    sendMessageStream(query, sessionId,
      (token) => {
        setStatusText('')
        setStreamingMsg(prev => ({ ...prev, content: (prev?.content || '') + token }))
      },
      (data) => {
        setStreamingMsg(prev => {
          const content = prev?.content || ''
          setMessages(msgs => [...msgs, {
            role: 'assistant', content,
            citations: data.citations || [],
            confidence: data.confidence || 0,
            message_id: data.message_id,
            responseTime: Date.now() - startTime,
          }])
          return null
        })
        setStatusText('')
        setLoading(false)
      },
      (err) => {
        setStreamingMsg(null)
        setStatusText('')
        setLoading(false)
        setError(`Something went wrong: ${err.message || 'Unknown error'}. Please try again.`)
      }
    )
  }, [loading, sessionId])

  const dbInfo    = dbConfig ? (DB_ICONS[dbConfig.db_type] || { icon: '🗄️', label: dbConfig.db_type, color: '#1d9e75' }) : null
  const firstName = user?.name?.split(' ')[0] || null
  const hasMessages = messages.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: '#f4f5f7', overflow: 'hidden', fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #e5e7eb', background: 'white', flexShrink: 0 }}>
        {/* Title row */}
        <div style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Knowledge Assistant</div>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 0 2px rgba(22,163,74,0.15)' }} />
          <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>online</span>
          {hasMessages && (
            <button onClick={() => exportChat(messages, sessionId)}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#374151' }}
            >
              <Download size={12} /> Export chat
            </button>
          )}
        </div>

        {/* Sources bar */}
        <div style={{ padding: '5px 24px 9px', display: 'flex', alignItems: 'center', gap: 7, borderTop: '1px solid #f3f4f6', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: 4 }}>Connected:</span>
          {dbInfo && <SourcePill icon={dbInfo.icon} label={`${dbInfo.label} · ${dbConfig?.database}`} color={dbInfo.color} active={!!sources.sql} />}
          <SourcePill icon="📄" label="SharePoint" color="#0078d4" active={!!sources.sharepoint} />
          <SourcePill icon="🔍" label="ChromaDB" color="#7c3aed" active={!!sources.chromadb} />
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column' }}>

        {error && <ErrorBanner message={error} onRetry={() => { setError(null); if (lastQuery) handleSend(lastQuery) }} />}

        {/* Empty state */}
        {!hasMessages && !loading && (
          <div style={{ margin: 'auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '32px 20px', maxWidth: 520 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.1), transparent)', animation: 'pulse 2s ease infinite' }} />
              <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: 'white', boxShadow: '0 8px 32px rgba(37,99,235,0.25)', position: 'relative' }}>N</div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111', letterSpacing: '-0.5px' }}>
              {firstName ? `Good ${getGreeting()}, ${firstName} 👋` : 'What would you like to know?'}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, fontWeight: 500 }}>
              Ask questions about your documents and databases in plain English
            </div>

            {/* Source mini cards */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 4 }}>
              {[
                { label: 'Documents',     value: 'SharePoint',  color: '#0078d4', Icon: FileText   },
                { label: 'Database',      value: dbInfo ? dbInfo.label : 'SQL', color: dbInfo?.color || '#1d9e75', Icon: Database },
                { label: 'Vector Search', value: 'ChromaDB',    color: '#7c3aed', Icon: Search     },
              ].map(item => (
                <div key={item.label} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 11, padding: '10px 16px', textAlign: 'center', minWidth: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <item.Icon size={18} color={item.color} strokeWidth={1.8} style={{ marginBottom: 5 }} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, fontWeight: 500 }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* Suggestions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 4 }}>
              {suggestions.map(s => (
                <button key={s} onClick={() => handleSend(s)}
                  style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 20, color: '#374151', fontSize: 12, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, transition: 'all 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb'; e.currentTarget.style.background = '#f8faff' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = 'white' }}
                >{s}</button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.filter(m => m?.role).map((msg, i) => (
          <MessageBubble key={i} message={msg} sessionId={sessionId} />
        ))}

        {/* Streaming */}
        {streamingMsg && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 20, animation: 'fadeIn 0.2s ease' }}>
            <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 2 }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'white', fontWeight: 800 }}>N</div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>NexusIQ</span>
                {statusText && (
                  <span style={{ fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500 }}>
                    <div style={{ width: 8, height: 8, border: '1.5px solid #d1d5db', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    {statusText}
                  </span>
                )}
              </div>
              {streamingMsg.content ? (
                <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '4px 14px 14px 14px', padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: '#111', whiteSpace: 'pre-wrap', fontWeight: 500, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {streamingMsg.content}
                    <span style={{ display: 'inline-block', width: 2, height: 16, background: '#2563eb', marginLeft: 2, animation: 'blink 1s step-end infinite', verticalAlign: 'middle', borderRadius: 1 }} />
                  </p>
                </div>
              ) : <SkeletonMessage />}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={handleSend} loading={loading} />
    </div>
  )
}