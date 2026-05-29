// frontend/src/pages/SettingsPage.jsx
import { useState, useEffect } from 'react'
import client from '../api/client'
import { useMsal } from '@azure/msal-react'
import HelpTooltip from '../components/HelpTooltip'

const DB_TYPES = [
  { value: 'mysql',      label: 'MySQL',      defaultPort: 3306, emoji: '🐬' },
  { value: 'snowflake',  label: 'Snowflake',  defaultPort: 443,  emoji: '❄️' },
  { value: 'databricks', label: 'Databricks', defaultPort: 443,  emoji: '🧱' },
  { value: 'postgresql', label: 'PostgreSQL', defaultPort: 5432, emoji: '🐘' },
  { value: 'exasol',     label: 'Exasol',     defaultPort: 8563, emoji: '⚡' },
]

const PDF_URL = 'http://localhost:8000/docs/NexusIQ_Integration_Setup_Guide.pdf'

const EMPTY_CONFIG = { host: '', port: '', username: '', password: '', database: '', schema: '', warehouse: '' }

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
      {label}
    </label>
    {children}
  </div>
)

const Input = ({ value, onChange, placeholder, type = 'text' }) => (
  <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
    onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
    onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
  />
)

const StatusMsg = ({ status }) => status ? (
  <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, background: status.ok ? 'rgba(29,158,117,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${status.ok ? 'rgba(29,158,117,0.2)' : 'rgba(239,68,68,0.2)'}`, color: status.ok ? '#1d9e75' : '#ef4444' }}>
    {status.ok ? '✓ ' : '✗ '}{status.message}
  </div>
) : null

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('database')
  const [dbType,    setDbType]    = useState('exasol')

  // Store credentials per DB type separately
  const [dbConfigs,  setDbConfigs]  = useState(() => {
    const saved = localStorage.getItem('nexusiq_db_configs')
    return saved ? JSON.parse(saved) : {}
  })
  const [connectedTypes, setConnectedTypes] = useState({})

  const [dbTesting,   setDbTesting]   = useState(false)
  const [dbSaving,    setDbSaving]    = useState(false)
  const [dbStatus,    setDbStatus]    = useState(null)
  const [activeDbType, setActiveDbType] = useState(null)

  // SharePoint state
  const { instance, accounts } = useMsal()
  const [siteUrl,      setSiteUrl]      = useState('')
  const [spConnecting, setSpConnecting] = useState(false)
  const [spStatus,     setSpStatus]     = useState(null)
  const [spConnected,  setSpConnected]  = useState(false)

  // Current form values for selected db type
  const current = dbConfigs[dbType] || { ...EMPTY_CONFIG, port: DB_TYPES.find(d => d.value === dbType)?.defaultPort || '' }

  const setField = (field, value) => {
    setDbConfigs(prev => {
      const updated = { ...prev, [dbType]: { ...(prev[dbType] || EMPTY_CONFIG), [field]: value } }
      localStorage.setItem('nexusiq_db_configs', JSON.stringify(updated))
      return updated
    })
    setDbStatus(null)
  }

  useEffect(() => {
    // Load active connection status
    client.get('/db/config').then(res => {
      if (res.data.connected) {
        setActiveDbType(res.data.db_type)
        setConnectedTypes(prev => ({ ...prev, [res.data.db_type]: true }))
      }
    }).catch(() => {})

    // Load saved connections list
    client.get('/db/connections').then(res => {
      const connected = {}
      res.data.connections?.forEach(c => { connected[c.db_type] = true })
      setConnectedTypes(connected)
    }).catch(() => {})

    client.get('/sharepoint/config').then(res => {
      if (res.data.connected) { setSpConnected(true); setSiteUrl(res.data.site_url || '') }
    }).catch(() => {})
  }, [])

  const handleDbTypeChange = (val) => {
    setDbType(val)
    setDbStatus(null)
    // If no port set yet, use default
    if (!dbConfigs[val]?.port) {
      const found = DB_TYPES.find(d => d.value === val)
      if (found) setField('port', found.defaultPort)
    }
  }

  const dbPayload = () => ({
    db_type:  dbType,
    host:     current.host,
    port:     Number(current.port),
    username: current.username,
    password: current.password,
    database: current.database,
    schema:   current.schema || null,
    warehouse: current.warehouse || null,
  })

  const handleDbTest = async () => {
    setDbTesting(true); setDbStatus(null)
    try {
      const res = await client.post('/db/test', dbPayload())
      setDbStatus({ ok: true, message: res.data.message })
    } catch (err) {
      setDbStatus({ ok: false, message: err.response?.data?.detail || 'Connection failed' })
    } finally { setDbTesting(false) }
  }

  const handleDbSave = async () => {
    setDbSaving(true); setDbStatus(null)
    try {
      await client.post('/db/save', dbPayload())
      setDbStatus({ ok: true, message: `${DB_TYPES.find(d=>d.value===dbType)?.label} connected and set as active` })
      setConnectedTypes(prev => ({ ...prev, [dbType]: true }))
      setActiveDbType(dbType)
    } catch (err) {
      setDbStatus({ ok: false, message: err.response?.data?.detail || 'Save failed' })
    } finally { setDbSaving(false) }
  }

  const handleSpConnect = async () => {
    if (!siteUrl.trim()) return
    setSpConnecting(true); setSpStatus(null)
    try {
      let token = null
      if (accounts.length > 0) {
        try {
          const res = await instance.acquireTokenSilent({ scopes: ['Sites.Read.All'], account: accounts[0] })
          token = res.accessToken
        } catch {}
      }
      await client.post('/sharepoint/save', { site_url: siteUrl.trim(), token })
      setSpStatus({ ok: true, message: 'SharePoint connected successfully' })
      setSpConnected(true)
    } catch (err) {
      setSpStatus({ ok: false, message: err.response?.data?.detail || 'Connection failed' })
    } finally { setSpConnecting(false) }
  }

  const isSnowflake   = dbType === 'snowflake'
  const isDatabricks  = dbType === 'databricks'
  const isTrino       = dbType === 'trino'
  const isExasol      = dbType === 'exasol'
  const needWarehouse = isSnowflake || isDatabricks
  const canTest = current.host && current.username && current.database
  const canSave = current.host && current.username && current.password && current.database

  const tabs = [
    { id: 'database',   label: '🗄️ Database',  connected: Object.keys(connectedTypes).length > 0 },
    { id: 'sharepoint', label: '📄 SharePoint', connected: spConnected },
    { id: 'help',       label: '📖 Help',       connected: false },
  ]

  return (
    <div style={{ flex: 1, background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <div style={{ padding: '14px 28px', borderBottom: '1px solid var(--border)', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 0 var(--border)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Connections</div>
        {activeDbType && (
          <div style={{ fontSize: 11, color: '#1d9e75', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1d9e75', display: 'inline-block' }} />
            Active: {DB_TYPES.find(d => d.value === activeDbType)?.label || activeDbType}
          </div>
        )}
      </div>

      <div style={{ padding: 32, maxWidth: 680, width: '100%', margin: '0 auto' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, marginBottom: 24 }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: '9px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: activeTab === tab.id ? 'white' : 'transparent', color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {tab.label}
              {tab.connected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1d9e75', display: 'inline-block' }} />}
            </button>
          ))}
        </div>

        {/* ── DATABASE TAB ── */}
        {activeTab === 'database' && (
          <div>
            {/* DB Type selector — shows connection status per type */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {DB_TYPES.map(db => {
                const isSelected  = dbType === db.value
                const isConnected = connectedTypes[db.value]
                const isActive    = activeDbType === db.value
                return (
                  <button key={db.value} onClick={() => handleDbTypeChange(db.value)} style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: isSelected ? 'rgba(37,99,235,0.06)' : 'var(--bg-secondary)',
                    color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                    transition: 'all 0.15s', position: 'relative',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span>{db.emoji}</span>
                    {db.label}
                    {isActive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1d9e75', flexShrink: 0 }} title="Active" />}
                    {isConnected && !isActive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8', flexShrink: 0 }} title="Saved" />}
                  </button>
                )
              })}
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 28, boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(29,158,117,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {DB_TYPES.find(d => d.value === dbType)?.emoji || '🗄️'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {DB_TYPES.find(d => d.value === dbType)?.label} Connection
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {connectedTypes[dbType]
                      ? activeDbType === dbType ? '● Active — queries routing through this database' : '● Saved — click Save & Activate to switch'
                      : 'Enter credentials to connect'}
                  </div>
                </div>
                {connectedTypes[dbType] && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: activeDbType === dbType ? '#1d9e75' : '#64748b', background: activeDbType === dbType ? 'rgba(29,158,117,0.1)' : '#f1f5f9', padding: '4px 10px', borderRadius: 100 }}>
                    {activeDbType === dbType ? '● Active' : '○ Saved'}
                  </div>
                )}
                <HelpTooltip title="Where to find these details" items={['Host: your DB server hostname or IP', 'Port: Trino=8080, Snowflake=443, Databricks=443, Exasol=8563', 'Snowflake account: e.g. tcsavgy-vc05902', 'Databricks: use workspace URL as host']} link={PDF_URL} />
              </div>

              {isSnowflake && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(41,182,246,0.06)', border: '1px solid rgba(41,182,246,0.2)', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                  ❄️ Use your <strong>account identifier</strong> as host — e.g. <code style={{ color: 'var(--accent)' }}>tcsavgy-vc05902</code>
                </div>
              )}
              {isTrino && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(0,148,240,0.06)', border: '1px solid rgba(0,148,240,0.2)', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                  🔷 Trino federates multiple data sources. Host: <code style={{ color: 'var(--accent)' }}>localhost</code>, Port: <code style={{ color: 'var(--accent)' }}>8080</code>
                </div>
              )}
              {isDatabricks && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,117,24,0.06)', border: '1px solid rgba(255,117,24,0.2)', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                  🧱 Use workspace URL as host. Use Personal Access Token as password.
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
                <Field label={isSnowflake ? 'Account Identifier' : 'Host'}>
                  <Input value={current.host} onChange={e => setField('host', e.target.value)} placeholder={isSnowflake ? 'tcsavgy-vc05902' : isDatabricks ? 'dbc-xxx.cloud.databricks.com' : 'localhost'} />
                </Field>
                <Field label="Port">
                  <Input value={current.port} onChange={e => setField('port', e.target.value)} type="number" placeholder="3306" />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Username">
                  <Input value={current.username} onChange={e => setField('username', e.target.value)} placeholder={isDatabricks ? 'token' : 'db_user'} />
                </Field>
                <Field label={isDatabricks ? 'Personal Access Token' : 'Password'}>
                  <Input type="password" value={current.password} onChange={e => setField('password', e.target.value)} placeholder="••••••••" />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Database Name">
                  <Input value={current.database} onChange={e => setField('database', e.target.value)} placeholder={isSnowflake ? 'YUVISHERE_DB' : 'my_database'} />
                </Field>
                <Field label="Schema (optional)">
                  <Input value={current.schema} onChange={e => setField('schema', e.target.value)} placeholder={isSnowflake ? 'PUBLIC' : 'public'} />
                </Field>
              </div>

              {needWarehouse && (
                <Field label={isSnowflake ? 'Warehouse' : 'HTTP Path'}>
                  <Input value={current.warehouse} onChange={e => setField('warehouse', e.target.value)} placeholder={isSnowflake ? 'COMPUTE_WH' : '/sql/1.0/warehouses/xxx'} />
                </Field>
              )}

              <StatusMsg status={dbStatus} />

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleDbTest} disabled={dbTesting || !canTest} style={{ flex: 1, padding: '11px', border: '1.5px solid var(--accent)', borderRadius: 8, background: 'transparent', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: dbTesting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: dbTesting || !canTest ? 0.6 : 1 }}>
                  {dbTesting ? 'Testing...' : 'Test Connection'}
                </button>
                <button onClick={handleDbSave} disabled={dbSaving || !canSave} style={{ flex: 2, padding: '11px', border: 'none', borderRadius: 8, background: dbSaving || !canSave ? 'var(--bg-hover)' : 'linear-gradient(135deg, #2563eb, #7c3aed)', color: dbSaving || !canSave ? 'var(--text-muted)' : 'white', fontSize: 13, fontWeight: 600, cursor: dbSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                  {dbSaving ? 'Saving...' : activeDbType === dbType ? '✓ Update & Activate' : 'Save & Activate'}
                </button>
              </div>
            </div>

            {/* Summary of all saved connections */}
            {Object.keys(connectedTypes).length > 0 && (
              <div style={{ marginTop: 20, background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                  Saved Connections
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {DB_TYPES.filter(db => connectedTypes[db.value]).map(db => (
                    <div key={db.value} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: activeDbType === db.value ? '#f0fdf4' : '#f9fafb', border: `1px solid ${activeDbType === db.value ? '#bbf7d0' : 'var(--border)'}` }}>
                      <span style={{ fontSize: 18 }}>{db.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{db.label}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{dbConfigs[db.value]?.database || ''}</div>
                      </div>
                      {activeDbType === db.value ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#1d9e75', background: '#dcfce7', padding: '3px 10px', borderRadius: 100 }}>Active</span>
                      ) : (
                        <button
                          onClick={() => { handleDbTypeChange(db.value); setTimeout(() => handleDbSave(), 100) }}
                          style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', background: '#eff6ff', border: 'none', padding: '3px 10px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SHAREPOINT TAB ── */}
        {activeTab === 'sharepoint' && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 28, boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(0,120,212,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📄</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>SharePoint Connection</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Connect your SharePoint site to search documents</div>
              </div>
              {spConnected && <div style={{ fontSize: 11, fontWeight: 600, color: '#1d9e75', background: 'rgba(29,158,117,0.1)', padding: '4px 10px', borderRadius: 100 }}>● Connected</div>}
              <HelpTooltip title="How to find your SharePoint URL" items={['Go to your SharePoint site in a browser', 'Copy base URL — stop at /sites/sitename', 'Example: https://company.sharepoint.com/sites/mysite']} link={PDF_URL} />
            </div>

            <Field label="SharePoint Site URL">
              <Input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://yourcompany.sharepoint.com/sites/yoursite" />
            </Field>

            <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.15)', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              🔒 NexusIQ uses your Microsoft login to access SharePoint — no extra credentials needed.
            </div>

            <StatusMsg status={spStatus} />

            <button onClick={handleSpConnect} disabled={spConnecting || !siteUrl.trim()} style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 8, background: spConnecting || !siteUrl.trim() ? 'var(--bg-hover)' : 'linear-gradient(135deg, #2563eb, #7c3aed)', color: spConnecting || !siteUrl.trim() ? 'var(--text-muted)' : 'white', fontSize: 13, fontWeight: 600, cursor: spConnecting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 21 21" fill="none"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
              {spConnecting ? 'Connecting...' : spConnected ? 'Update Connection' : 'Connect with Microsoft'}
            </button>
          </div>
        )}

        {/* ── HELP TAB ── */}
        {activeTab === 'help' && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 28, boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(79,70,229,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📖</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Help & Documentation</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Setup guides and troubleshooting</div>
              </div>
            </div>
            <a href={PDF_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderRadius: 10, border: '1.5px solid var(--accent)', background: 'rgba(37,99,235,0.04)', marginBottom: 20, cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,99,235,0.08)' }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37,99,235,0.04)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📄</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)', marginBottom: 3 }}>Integration Setup Guide</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>SharePoint · Database setup · Permissions · Troubleshooting</div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>Download PDF →</span>
              </div>
            </a>
            {[
              { icon: '🔑', title: 'Azure App Registration', steps: ['Go to portal.azure.com → Azure Active Directory → App registrations', 'Click New registration → Name: NexusIQ → SPA redirect: http://localhost:3000', 'Add permissions: Sites.Read.All, Files.Read.All, User.Read', 'Click Grant admin consent → Create client secret → Copy to .env'] },
              { icon: '❄️', title: 'Snowflake Connection', steps: ['Account identifier is in your Snowflake URL e.g. tcsavgy-vc05902', 'Use it as the Host field in NexusIQ', 'Warehouse: your compute warehouse e.g. COMPUTE_WH', 'Schema: typically PUBLIC or your custom schema'] },
              { icon: '🧱', title: 'Databricks Connection', steps: ['Host: your workspace URL e.g. dbc-xxx.cloud.databricks.com', 'Password: your Personal Access Token (not your login password)', 'HTTP Path: from Databricks → SQL Warehouse → Connection details', 'Database: your catalog name e.g. samples'] },
              { icon: '⚠️', title: 'Common Issues', steps: ['AADSTS70011: Add Sites.Read.All permission and grant admin consent', 'Snowflake login failed: check account identifier format', 'SQL connection refused: check host, port, and GRANT privileges', 'Documents not found: run Sync SharePoint from the Knowledge tab'] },
            ].map(card => (
              <div key={card.title} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 16 }}>{card.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{card.title}</span>
                </div>
                <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {card.steps.map((step, i) => <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{step}</li>)}
                </ol>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}