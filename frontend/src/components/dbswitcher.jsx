import { useState, useEffect, useRef } from 'react'
import { Database, ChevronDown, Check, Plus, Zap, Loader, GitMerge } from 'lucide-react'
import client from '../api/client'

const DB_ICONS = {
  mysql:          { emoji: '🐬', color: '#00758f' },
  snowflake:      { emoji: '❄️', color: '#29b5e8' },
  databricks:     { emoji: '🧱', color: '#ff3621' },
  postgresql:     { emoji: '🐘', color: '#336791' },
  exasol:         { emoji: '⚡', color: '#00d4aa' },
  virtual_schema: { emoji: '🌐', color: '#6366f1' },
}
const DB_LABELS = {
  mysql: 'MySQL', snowflake: 'Snowflake', databricks: 'Databricks',
  postgresql: 'PostgreSQL', exasol: 'Exasol', virtual_schema: 'Exasol Virtual Schema',
}
const DB_DESCRIPTIONS = {
  mysql:      'Operational Database',
  snowflake:  'Cloud Data Warehouse',
  databricks: 'AI/ML Data Platform',
  postgresql: 'Relational Database',
  exasol:     'Analytical Database',
}
const STATIC_CONNECTIONS = [
  { id: 'mysql',      db_type: 'mysql',      name: 'MySQL',      database: 'nexusiq',      host: 'localhost' },
  { id: 'snowflake',  db_type: 'snowflake',  name: 'Snowflake',  database: 'yuvishere_db', host: 'tcsavgy-vc05902.snowflakecomputing.com' },
  { id: 'databricks', db_type: 'databricks', name: 'Databricks', database: 'samples',      host: 'dbc-69ced1cd-bfc0.cloud.databricks.com' },
  { id: 'postgresql', db_type: 'postgresql', name: 'PostgreSQL', database: 'defaultdb',    host: 'localhost' },
  { id: 'exasol',     db_type: 'exasol',     name: 'Exasol',     database: 'NEXUSIQ',      host: 'localhost', port: 8563 },
]
const EXASOL_VS_CONN = {
  id: 'exasol_vs', db_type: 'virtual_schema', name: 'Exasol Virtual Schema',
  database: 'All sources unified',
  virtual_schemas: ['MYSQL_VS', 'SNOWFLAKE_VS', 'DATABRICKS_VS', 'POSTGRES_VS'],
}

export default function DBSwitcher({ onSwitch }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(null)
  const [switching, setSwitching] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    loadActive()
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadActive = async () => {
    try {
      const res = await client.get('/db/connections')
      const a = res.data.active
      if (a?.db_type === 'virtual_schema') { setActive(EXASOL_VS_CONN); return }
      const match = a ? STATIC_CONNECTIONS.find(c => c.db_type === a.db_type) : null
      setActive(match || null)
    } catch { setActive(null) }
  }

  const handleSwitch = async (conn) => {
    setSwitching(true); setOpen(false)
    try { await client.post('/db/switch', { connection_id: conn.id, dsn: conn.dsn, db_type: conn.db_type }) } catch {}
    setActive(conn); if (onSwitch) onSwitch(conn); setSwitching(false)
  }

  const handleExasolVS = async () => {
    setSwitching(true); setOpen(false)
    try { await client.post('/db/switch', { connection_id: 'exasol_vs', db_type: 'virtual_schema' }) } catch {}
    setActive(EXASOL_VS_CONN); if (onSwitch) onSwitch(EXASOL_VS_CONN); setSwitching(false)
  }

  const isVSActive = active?.id === 'exasol_vs' || active?.db_type === 'virtual_schema'
  const activeInfo = active ? (DB_ICONS[active.db_type] || DB_ICONS.exasol) : null

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 8,
        border: isVSActive ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.2)',
        background: isVSActive
          ? 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(124,58,237,0.3))'
          : 'rgba(255,255,255,0.1)',
        cursor: 'pointer', fontFamily: 'inherit',
      }}>
        {switching ? <Loader size={14} color="white" style={{ animation: 'spin 1s linear infinite' }} /> : <span style={{ fontSize: 14 }}>{activeInfo?.emoji || '🗄️'}</span>}
        <span style={{ fontSize: 12, fontWeight: 600, color: 'white', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {active ? (active.name || DB_LABELS[active.db_type] || active.db_type) : 'Select DB'}
        </span>
        <ChevronDown size={11} color="rgba(255,255,255,0.6)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 44, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.15)', minWidth: 280, zIndex: 300, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Database size={10} /> Active Database
            </div>
          </div>

          <div style={{ padding: '6px 0' }}>
            {STATIC_CONNECTIONS.map((conn) => {
              const isActive = !isVSActive && active?.db_type === conn.db_type
              const info = DB_ICONS[conn.db_type]
              return (
                <button key={conn.id} onClick={() => handleSwitch(conn)}
                  style={{ width: '100%', padding: '9px 14px', border: 'none', background: isActive ? '#f0f9ff' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f9fafb' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: info.color + '15', border: '1px solid ' + info.color + '30', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{info.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{conn.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{DB_DESCRIPTIONS[conn.db_type]}</div>
                  </div>
                  {isActive && <Check size={14} color="#2563eb" strokeWidth={2.5} />}
                </button>
              )
            })}
          </div>

          <div style={{ height: 1, background: '#f3f4f6', margin: '0 14px' }} />

          <div style={{ padding: '8px 0 6px' }}>
            <div style={{ padding: '4px 14px 6px', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <GitMerge size={10} /> Federated Layer
            </div>
            <button onClick={handleExasolVS}
              style={{ width: '100%', padding: '9px 14px', border: 'none', background: isVSActive ? 'linear-gradient(135deg, #eef2ff, #f5f3ff)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}
              onMouseEnter={e => { if (!isVSActive) e.currentTarget.style.background = '#f5f3ff' }}
              onMouseLeave={e => { if (!isVSActive) e.currentTarget.style.background = 'transparent' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: 'linear-gradient(135deg, #6366f120, #7c3aed20)', border: isVSActive ? '1px solid #6366f1' : '1px solid #6366f130', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>⚡</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Exasol Virtual Schema
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase' }}>Live</span>
                </div>
                <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 500 }}>MySQL · Snowflake · Databricks · PostgreSQL</div>
              </div>
              {isVSActive ? <Check size={14} color="#6366f1" strokeWidth={2.5} /> : <Zap size={12} color="#6366f1" />}
            </button>
            {isVSActive && (
              <div style={{ padding: '4px 14px 6px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {EXASOL_VS_CONN.virtual_schemas.map(vs => (
                  <span key={vs} style={{ fontSize: 10, fontWeight: 600, color: '#6366f1', background: '#eef2ff', padding: '2px 8px', borderRadius: 20, border: '1px solid #c7d2fe' }}>{vs}</span>
                ))}
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #f3f4f6', padding: '6px 0' }}>
            <button onClick={() => { setOpen(false); document.dispatchEvent(new CustomEvent('nexusiq:nav', { detail: 'settings' })) }}
              style={{ width: '100%', padding: '9px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, color: '#6b7280', fontSize: 12, fontWeight: 600 }}
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={14} color="#6b7280" /></div>
              Manage connections
            </button>
          </div>
        </div>
      )}
      <style>{"@keyframes spin { to { transform: rotate(360deg) } }"}</style>
    </div>
  )
}
