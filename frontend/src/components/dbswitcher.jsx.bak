import { useState, useEffect, useRef } from 'react'
import { Database, ChevronDown, Check, Plus, Zap, Loader } from 'lucide-react'
import client from '../api/client'

const DB_ICONS = {
  mysql:          { emoji: '🐬', color: '#00758f' },
  snowflake:      { emoji: '❄️', color: '#29b5e8' },
  databricks:     { emoji: '🧱', color: '#ff3621' },
  postgresql:     { emoji: '🐘', color: '#336791' },
  exasol:         { emoji: '⚡', color: '#00d4aa' },
  redshift:       { emoji: '🔴', color: '#8c4fff' },
  virtual_schema: { emoji: '🌐', color: '#6366f1' },
}

const DB_LABELS = {
  mysql:          'MySQL',
  snowflake:      'Snowflake',
  databricks:     'Databricks',
  postgresql:     'PostgreSQL',
  exasol:         'Exasol',
  redshift:       'Redshift',
  virtual_schema: 'Exasol Virtual Schema',
}

// ── Exasol Virtual Schema static entry ────────────────────────────────────
const EXASOL_VS_CONN = {
  id:        'exasol_vs',
  db_type:   'virtual_schema',
  name:      'Exasol Virtual Schema',
  database:  'NEXUSIQ_VS · SNOWFLAKE_VS',
  host:      '18.232.62.176',
  dsn:       'exasol+pyexasol://sys:exasol@18.232.62.176:8563',
  emoji:     '⚡',
  is_live:   true,
  virtual_schemas: ['NEXUSIQ_VS', 'SNOWFLAKE_VS'],
}

export default function DBSwitcher({ onSwitch }) {
  const [open,        setOpen]        = useState(false)
  const [connections, setConnections] = useState([])
  const [active,      setActive]      = useState(null)
  const [switching,   setSwitching]   = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    loadConnections()
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadConnections = async () => {
    try {
      const res = await client.get('/db/connections')
      setConnections(res.data.connections || [])
      setActive(res.data.active || null)
    } catch {
      try {
        const cfg = await client.get('/db/config')
        if (cfg.data.connected) {
          setActive({ db_type: cfg.data.db_type, name: DB_LABELS[cfg.data.db_type] || cfg.data.db_type, database: cfg.data.database })
        }
      } catch {}
    }
  }

  const handleSwitch = async (conn) => {
    setSwitching(true)
    setOpen(false)
    try {
      await client.post('/db/switch', { connection_id: conn.id, dsn: conn.dsn })
      setActive(conn)
      if (onSwitch) onSwitch(conn)
      await loadConnections()
    } catch (err) {
      console.error('Switch failed:', err)
      // Still update UI optimistically
      setActive(conn)
      if (onSwitch) onSwitch(conn)
    } finally {
      setSwitching(false)
    }
  }

  const handleExasolVS = async () => {
    setSwitching(true)
    setOpen(false)
    try {
      await client.post('/db/switch', {
        connection_id: 'exasol_vs',
        dsn: EXASOL_VS_CONN.dsn,
        db_type: 'virtual_schema',
      })
    } catch (err) {
      console.error('Exasol VS switch failed:', err)
    } finally {
      setActive(EXASOL_VS_CONN)
      if (onSwitch) onSwitch(EXASOL_VS_CONN)
      setSwitching(false)
    }
  }

  const isExasolVSActive = active?.id === 'exasol_vs' || active?.db_type === 'virtual_schema'
  const activeInfo = active ? (DB_ICONS[active.db_type] || DB_ICONS.mysql) : null

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '5px 11px', borderRadius: 8,
          border: isExasolVSActive
            ? '1px solid rgba(99,102,241,0.5)'
            : '1px solid rgba(255,255,255,0.2)',
          background: isExasolVSActive
            ? 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(124,58,237,0.3))'
            : open ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
          cursor: 'pointer', fontFamily: 'inherit',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!isExasolVSActive) e.currentTarget.style.background = 'rgba(255,255,255,0.18)' }}
        onMouseLeave={e => { if (!open && !isExasolVSActive) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
      >
        {switching ? (
          <Loader size={14} color="white" style={{ animation: 'spin 1s linear infinite' }} />
        ) : (
          <span style={{ fontSize: 14 }}>{activeInfo?.emoji || '🗄️'}</span>
        )}
        <span style={{ fontSize: 12, fontWeight: 600, color: 'white', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {active ? (DB_LABELS[active.db_type] || active.name || active.db_type) : 'No DB'}
        </span>
        <ChevronDown size={11} color="rgba(255,255,255,0.6)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 44, right: 0,
          background: 'white', border: '1px solid #e5e7eb',
          borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
          minWidth: 260, zIndex: 300, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Database size={10} /> Active Database
            </div>
          </div>

          {/* Saved connections */}
          {connections.length > 0 ? (
            <div style={{ padding: '6px 0' }}>
              {connections.map((conn) => {
                const isActive = !isExasolVSActive && (active?.id === conn.id || (active?.db_type === conn.db_type && !conn.id))
                const info = DB_ICONS[conn.db_type] || DB_ICONS.mysql
                return (
                  <button
                    key={conn.id || conn.db_type}
                    onClick={() => !conn.is_placeholder && handleSwitch(conn)}
                    disabled={conn.is_placeholder}
                    style={{
                      width: '100%', padding: '9px 14px',
                      border: 'none', background: isActive ? '#f0f9ff' : 'transparent',
                      cursor: conn.is_placeholder ? 'default' : 'pointer',
                      fontFamily: 'inherit', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'background 0.1s',
                      opacity: conn.is_placeholder ? 0.6 : 1,
                    }}
                    onMouseEnter={e => { if (!conn.is_placeholder && !isActive) e.currentTarget.style.background = '#f9fafb' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: `${info.color}15`,
                      border: `1px solid ${info.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14,
                    }}>
                      {conn.emoji || info.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111', display: 'flex', alignItems: 'center', gap: 5 }}>
                        {conn.name || DB_LABELS[conn.db_type] || conn.db_type}
                        {conn.is_placeholder && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#6366f1', background: '#eef2ff', padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase' }}>
                            Soon
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conn.database || conn.host || ''}
                      </div>
                    </div>
                    {isActive && <Check size={14} color="#2563eb" strokeWidth={2.5} />}
                  </button>
                )
              })}
            </div>
          ) : (
            <div style={{ padding: '20px 14px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
              No connections saved yet
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: '#f3f4f6', margin: '0 14px' }} />

          {/* ── Exasol Virtual Schema — now LIVE and selectable ── */}
          <div style={{ padding: '8px 0 6px' }}>
            <div style={{ padding: '4px 14px 6px', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Unified Data Plane
            </div>
            <button
              onClick={handleExasolVS}
              style={{
                width: '100%', padding: '9px 14px',
                border: 'none',
                background: isExasolVSActive
                  ? 'linear-gradient(135deg, #eef2ff, #f5f3ff)'
                  : 'transparent',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 10,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!isExasolVSActive) e.currentTarget.style.background = '#f5f3ff' }}
              onMouseLeave={e => { if (!isExasolVSActive) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: 'linear-gradient(135deg, #6366f120, #7c3aed20)',
                border: isExasolVSActive ? '1px solid #6366f1' : '1px solid #6366f130',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14,
              }}>
                ⚡
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Exasol Virtual Schema
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    color: '#059669', background: '#d1fae5',
                    padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase'
                  }}>
                    Live
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 500 }}>
                  MySQL · Snowflake · Federated
                </div>
              </div>
              {isExasolVSActive
                ? <Check size={14} color="#6366f1" strokeWidth={2.5} />
                : <Zap size={12} color="#6366f1" />
              }
            </button>

            {/* Virtual Schema pills — shown when active */}
            {isExasolVSActive && (
              <div style={{ padding: '4px 14px 6px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {EXASOL_VS_CONN.virtual_schemas.map(vs => (
                  <span key={vs} style={{
                    fontSize: 10, fontWeight: 600,
                    color: '#6366f1', background: '#eef2ff',
                    padding: '2px 8px', borderRadius: 20,
                    border: '1px solid #c7d2fe',
                  }}>
                    {vs}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Add connection */}
          <div style={{ borderTop: '1px solid #f3f4f6', padding: '6px 0' }}>
            <button
              onClick={() => { setOpen(false); document.dispatchEvent(new CustomEvent('nexusiq:nav', { detail: 'settings' })) }}
              style={{
                width: '100%', padding: '9px 14px',
                border: 'none', background: 'transparent',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 10,
                color: '#6b7280', fontSize: 12, fontWeight: 600,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={14} color="#6b7280" />
              </div>
              Manage connections
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}