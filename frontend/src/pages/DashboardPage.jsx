import { useState, useEffect } from 'react'
import { Search, FileText, Database, MessageSquare, Upload, RefreshCw, Settings, ChevronRight, Info, AlertCircle } from 'lucide-react'
import client from '../api/client'
import { getConversations, getSuggestions } from '../api/chat'

const DB_META = {
  mysql:      { label: 'MySQL',      color: '#1d9e75' },
  snowflake:  { label: 'Snowflake',  color: '#0e7490' },
  databricks: { label: 'Databricks', color: '#ea580c' },
  postgresql: { label: 'PostgreSQL', color: '#336791' },
  exasol:     { label: 'Exasol',     color: '#6d28d9' },
  redshift:   { label: 'Redshift',   color: '#8c4fff' },
}

// Shimmer skeleton
const Shimmer = ({ w = '100%', h = 16, r = 6, mb = 0 }) => (
  <div style={{
    width: w, height: h, borderRadius: r, marginBottom: mb,
    background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
  }} />
)

const StatCardSkeleton = ({ accentColor = '#e5e7eb' }) => (
  <div style={{ background: 'white', borderRadius: 14, padding: '22px 20px', border: '1px solid #e5e7eb', position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accentColor, opacity: 0.3 }} />
    <Shimmer w={52} h={52} r={14} mb={14} />
    <Shimmer w="55%" h={32} r={6} mb={8} />
    <Shimmer w="75%" h={13} r={4} mb={6} />
    <Shimmer w="55%" h={11} r={4} />
  </div>
)

const StatCard = ({ icon: Icon, iconColor, iconBg, accentColor, trend, value, label, sub, smallValue }) => (
  <div style={{ background: 'white', borderRadius: 14, padding: '22px 20px', border: '1px solid #e5e7eb', position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accentColor }} />
    {trend && <div style={{ position: 'absolute', top: 18, right: 16, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: iconBg, color: iconColor }}>{trend}</div>}
    <div style={{ width: 52, height: 52, borderRadius: 14, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
      <Icon size={26} color={iconColor} strokeWidth={1.8} />
    </div>
    <div style={{ fontSize: smallValue ? 17 : 32, fontWeight: 800, letterSpacing: smallValue ? '-0.3px' : '-1px', color: iconColor, marginBottom: 4, lineHeight: 1, paddingTop: smallValue ? 6 : 0, paddingBottom: smallValue ? 6 : 0 }}>{value}</div>
    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>{sub}</div>
  </div>
)

const QuickAction = ({ icon: Icon, iconColor, iconBg, label, desc, onClick }) => (
  <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%', transition: 'all 0.15s', marginBottom: 9 }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.06)'; e.currentTarget.style.transform = 'translateX(2px)' }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
  >
    <div style={{ width: 40, height: 40, borderRadius: 11, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={20} color={iconColor} strokeWidth={2} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>{desc}</div>
    </div>
    <ChevronRight size={14} color="#d1d5db" />
  </button>
)

const ErrorBanner = ({ message, onRetry }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, marginBottom: 20 }}>
    <AlertCircle size={15} color="#ef4444" />
    <span style={{ fontSize: 13, color: '#dc2626', flex: 1, fontWeight: 500 }}>{message}</span>
    {onRetry && <button onClick={onRetry} style={{ fontSize: 12, color: '#dc2626', fontWeight: 700, background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>}
  </div>
)

const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

export default function DashboardPage({ user, onTabChange, onNewChat, onSelectSession }) {
  const [stats,         setStats]         = useState({ total_chunks: 0, total_docs: 0 })
  const [sources,       setSources]       = useState({})
  const [dbConfig,      setDbConfig]      = useState(null)
  const [conversations, setConversations] = useState([])
  const [suggestions,   setSuggestions]   = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [syncing,       setSyncing]       = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [sr, dr, docr, convr, sugr] = await Promise.all([
        client.get('/sources/status'),
        client.get('/db/config'),
        client.get('/documents'),
        getConversations(),
        getSuggestions(),
      ])
      setSources(sr.data || {})
      setDbConfig(dr.data?.connected ? dr.data : null)
      setStats({ total_chunks: docr.data.total_chunks || 0, total_docs: docr.data.total_docs || 0 })
      setConversations((convr.data.conversations || []).slice(0, 4))
      setSuggestions(sugr.data.suggestions || [])
    } catch (err) {
      setError('Some data could not be loaded. Check your backend is running.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleSync = async () => {
    setSyncing(true)
    try { await client.post('/documents/sync') } catch {}
    setTimeout(() => { setSyncing(false); onTabChange('knowledge') }, 1000)
  }

  const dbMeta    = dbConfig ? (DB_META[dbConfig.db_type] || { label: dbConfig.db_type, color: '#1d9e75' }) : null
  const firstName = user?.name?.split(' ')[0] || 'there'

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#f4f5f7', fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
      {/* Shimmer keyframe */}
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 28px' }}>

        {/* Greeting */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#111', letterSpacing: '-0.5px', marginBottom: 4 }}>
            Good {getGreeting()}, {firstName}
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Here's what's happening with your knowledge base today.</div>
        </div>

        {error && <ErrorBanner message={error} onRetry={loadData} />}

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          {loading ? (
            <>
              <StatCardSkeleton accentColor="#2563eb" />
              <StatCardSkeleton accentColor="#16a34a" />
              <StatCardSkeleton accentColor="#0891b2" />
              <StatCardSkeleton accentColor="#7c3aed" />
            </>
          ) : (
            <>
              <StatCard icon={Search} iconColor="#1d4ed8" iconBg="#dbeafe" accentColor="linear-gradient(90deg,#2563eb,#60a5fa)" trend="↑ Live" value={stats.total_chunks.toLocaleString()} label="Chunks Indexed" sub="ChromaDB vector store" />
              <StatCard icon={FileText} iconColor="#15803d" iconBg="#dcfce7" accentColor="linear-gradient(90deg,#16a34a,#4ade80)" trend={`${stats.total_docs} docs`} value={stats.total_docs} label="Documents" sub="Indexed from SharePoint" />
              <StatCard icon={Database} iconColor="#0e7490" iconBg="#cffafe" accentColor="linear-gradient(90deg,#0891b2,#22d3ee)" trend={dbMeta ? dbMeta.label : 'None'} value={dbConfig ? dbConfig.database : '—'} label={dbMeta ? `${dbMeta.label} Connected` : 'No DB Connected'} sub={dbConfig ? `${dbConfig.db_type} · ${dbConfig.host}` : 'Connect in Settings'} smallValue={!!dbConfig} />
              <StatCard icon={MessageSquare} iconColor="#6d28d9" iconBg="#ede9fe" accentColor="linear-gradient(90deg,#7c3aed,#a78bfa)" trend="Active" value={conversations.length} label="Conversations" sub="Total sessions" />
            </>
          )}
        </div>

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>

          {/* Quick Actions */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 12 }}>Quick Actions</div>
            <QuickAction icon={MessageSquare} iconColor="#2563eb" iconBg="#eff6ff" label="New Chat"        desc="Start a new conversation with your data"   onClick={onNewChat} />
            <QuickAction icon={Upload}        iconColor="#16a34a" iconBg="#f0fdf4" label="Upload Data"     desc="Load CSV or Excel files into your database" onClick={() => onTabChange('data')} />
            <QuickAction icon={syncing ? RefreshCw : RefreshCw} iconColor="#ea580c" iconBg="#fff7ed" label={syncing ? 'Syncing...' : 'Sync SharePoint'} desc="Fetch the latest documents from SharePoint" onClick={handleSync} />
            <QuickAction icon={Settings}      iconColor="#7c3aed" iconBg="#f5f3ff" label="Connections"     desc="Manage database and SharePoint connections" onClick={() => onTabChange('settings')} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

            {/* Recent Conversations */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 12 }}>Recent Conversations</div>
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 11, overflow: 'hidden' }}>
                {loading ? (
                  <div style={{ padding: '16px' }}>
                    {[1,2,3].map(i => <Shimmer key={i} h={14} r={6} mb={12} />)}
                  </div>
                ) : conversations.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: 13, fontWeight: 500 }}>No conversations yet — start chatting!</div>
                ) : (
                  conversations.map((conv, i) => (
                    <div key={conv.session_id}
                      onClick={() => { onSelectSession(conv.session_id); onTabChange('chat') }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 15px', cursor: 'pointer', borderBottom: i < conversations.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? '#2563eb' : '#d1d5db', flexShrink: 0, boxShadow: i === 0 ? '0 0 0 2px rgba(37,99,235,0.2)' : 'none' }} />
                      <span style={{ fontSize: 12.5, color: i === 0 ? '#374151' : '#6b7280', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{conv.title}</span>
                      <ChevronRight size={12} color="#d1d5db" />
                    </div>
                  ))
                )}
                <div onClick={() => onTabChange('chat')}
                  style={{ padding: '9px 15px', textAlign: 'center', fontSize: 12, color: '#2563eb', fontWeight: 600, cursor: 'pointer', borderTop: '1px solid #f3f4f6', background: '#f9fafb', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                  onMouseLeave={e => e.currentTarget.style.background = '#f9fafb'}
                >View all conversations →</div>
              </div>
            </div>

            {/* Suggested Queries */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 12 }}>Suggested Queries</div>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1,2,3].map(i => <Shimmer key={i} h={40} r={10} />)}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {suggestions.slice(0, 3).map(s => (
                    <button key={s} onClick={() => { onNewChat(s); onTabChange('chat') }}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontSize: 12.5, color: '#374151', fontWeight: 500, transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb'; e.currentTarget.style.background = '#f8faff' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = 'white' }}
                    >
                      <Info size={14} color="#f59e0b" strokeWidth={2} style={{ flexShrink: 0 }} />
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 11, padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 22, marginTop: 22, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>System Status</span>
          {[
            { label: 'SharePoint MCP', active: sources.sharepoint, color: '#0078d4', bg: '#e0f2fe', tc: '#0369a1' },
            { label: 'SQL MCP',        active: sources.sql,        color: '#16a34a', bg: '#f0fdf4', tc: '#15803d' },
            { label: 'ChromaDB RAG',   active: sources.chromadb,   color: '#7c3aed', bg: '#f5f3ff', tc: '#6d28d9' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.active ? s.color : '#d1d5db', boxShadow: s.active ? `0 0 0 3px ${s.color}25` : 'none' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{s.label}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: s.active ? s.bg : '#f3f4f6', color: s.active ? s.tc : '#9ca3af' }}>{s.active ? 'live' : 'off'}</span>
            </div>
          ))}
          {!loading && (
            <button onClick={loadData} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '3px 8px', borderRadius: 6, transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#374151' }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6b7280' }}>
              <RefreshCw size={11} /> Refresh
            </button>
          )}
        </div>
      </div>
    </div>
  )
}