import { useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { Zap, Database, FileText, CheckCircle, ChevronRight, AlertCircle } from 'lucide-react'
import client from '../api/client'
import HelpTooltip from '../components/HelpTooltip'

const STEPS = [
  { label: 'Database',   Icon: Database  },
  { label: 'SharePoint', Icon: FileText  },
  { label: 'Ready',      Icon: CheckCircle },
]

const PDF_URL = 'http://localhost:8000/docs/NexusIQ_Integration_Setup_Guide.pdf'

const DB_TYPES = [
  { value: 'mysql',      label: 'MySQL',      defaultPort: 3306, needsWarehouse: false },
  { value: 'snowflake',  label: 'Snowflake',  defaultPort: 443,  needsWarehouse: true  },
  { value: 'databricks', label: 'Databricks', defaultPort: 443,  needsWarehouse: true  },
  { value: 'postgresql', label: 'PostgreSQL', defaultPort: 5432, needsWarehouse: false },
  { value: 'exasol',     label: 'Exasol',     defaultPort: 8563, needsWarehouse: false },
  { value: 'redshift',   label: 'Redshift',   defaultPort: 5439, needsWarehouse: false },
]

const Field = ({ label, children, tooltip }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
      {tooltip && <HelpTooltip title={tooltip.title} items={tooltip.items} link={tooltip.link} />}
    </div>
    {children}
  </div>
)

const Input = ({ value, onChange, placeholder, type = 'text' }) => (
  <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    style={{ width: '100%', padding: '10px 14px', background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 9, fontSize: 13, color: '#111', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', fontWeight: 500, transition: 'border-color 0.15s' }}
    onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.background = 'white' }}
    onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9fafb' }}
  />
)

const StatusMsg = ({ status }) => !status ? null : (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 9, marginBottom: 16, fontSize: 13, fontWeight: 600, background: status.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${status.ok ? '#bbf7d0' : '#fecaca'}`, color: status.ok ? '#15803d' : '#dc2626' }}>
    {status.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
    {status.message}
  </div>
)

function StepDatabase({ onNext, onSkip }) {
  const [dbType,    setDbType]    = useState('mysql')
  const [host,      setHost]      = useState('')
  const [port,      setPort]      = useState(3306)
  const [username,  setUsername]  = useState('')
  const [password,  setPassword]  = useState('')
  const [database,  setDatabase]  = useState('')
  const [schema,    setSchema]    = useState('')
  const [warehouse, setWarehouse] = useState('')
  const [testing,   setTesting]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [status,    setStatus]    = useState(null)

  const dbMeta = DB_TYPES.find(d => d.value === dbType)
  const needsWarehouse = dbMeta?.needsWarehouse

  const payload = () => ({ db_type: dbType, host, port: Number(port), username, password, database, schema: schema || null, warehouse: warehouse || null })

  const handleDbTypeChange = (val) => {
    setDbType(val)
    const found = DB_TYPES.find(d => d.value === val)
    if (found) setPort(found.defaultPort)
    setWarehouse('')
  }

  const handleTest = async () => {
    setTesting(true); setStatus(null)
    try { const r = await client.post('/db/test', payload()); setStatus({ ok: true, message: r.data.message }) }
    catch (e) { setStatus({ ok: false, message: e.response?.data?.detail || 'Connection failed' }) }
    finally { setTesting(false) }
  }

  const handleSave = async () => {
    setSaving(true); setStatus(null)
    try {
      await client.post('/db/save', payload())
      setStatus({ ok: true, message: 'Database connected successfully!' })
      setTimeout(() => onNext({ db: true }), 800)
    }
    catch (e) { setStatus({ ok: false, message: e.response?.data?.detail || 'Save failed' }) }
    finally { setSaving(false) }
  }

  const canTest = host && username && database
  const canSave = host && username && password && database

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 style={s.stepTitle}>Connect your database</h2>
        <HelpTooltip title="Where to find these details" items={['Host: your DB server hostname or IP', 'Snowflake: use account identifier e.g. tcsavgy-vc05902', 'Port: MySQL=3306, Snowflake=443, Exasol=8563', 'Create a read-only user for security']} link={PDF_URL} />
      </div>
      <p style={s.stepDesc}>NexusIQ will query your database in plain English. You can skip and connect later from Settings.</p>

      {/* DB Type selector */}
      <Field label="Database Type">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {DB_TYPES.map(db => (
            <button key={db.value} onClick={() => handleDbTypeChange(db.value)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: dbType === db.value ? '2px solid #2563eb' : '1.5px solid #e5e7eb', background: dbType === db.value ? '#eff6ff' : '#f9fafb', color: dbType === db.value ? '#2563eb' : '#6b7280', transition: 'all 0.15s' }}>
              {db.label}
            </button>
          ))}
        </div>
      </Field>

      {/* Snowflake hint */}
      {dbType === 'snowflake' && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#f0f9ff', border: '1px solid #bae6fd', fontSize: 12, color: '#0369a1', marginBottom: 16, lineHeight: 1.6, fontWeight: 500 }}>
          ❄️ Use your account identifier as host — e.g. <code style={{ background: '#e0f2fe', padding: '1px 5px', borderRadius: 3 }}>tcsavgy-vc05902</code>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 12 }}>
        <Field label={dbType === 'snowflake' ? 'Account Identifier' : 'Host'}>
          <Input value={host} onChange={e => setHost(e.target.value)} placeholder={dbType === 'snowflake' ? 'tcsavgy-vc05902' : 'localhost'} />
        </Field>
        <Field label="Port">
          <Input value={port} onChange={e => setPort(e.target.value)} type="number" placeholder="3306" />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Username">
          <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="db_user" />
        </Field>
        <Field label="Password">
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Database Name">
          <Input value={database} onChange={e => setDatabase(e.target.value)} placeholder="my_database" />
        </Field>
        <Field label="Schema (optional)">
          <Input value={schema} onChange={e => setSchema(e.target.value)} placeholder="public" />
        </Field>
      </div>

      {needsWarehouse && (
        <Field label={dbType === 'snowflake' ? 'Warehouse' : 'HTTP Path'}>
          <Input value={warehouse} onChange={e => setWarehouse(e.target.value)} placeholder={dbType === 'snowflake' ? 'COMPUTE_WH' : '/sql/1.0/warehouses/xxx'} />
        </Field>
      )}

      <StatusMsg status={status} />

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={handleTest} disabled={testing || !canTest} style={{ ...s.btnOutline, opacity: testing || !canTest ? 0.5 : 1 }}>
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <button onClick={handleSave} disabled={saving || !canSave} style={{ ...s.btnPrimary, opacity: saving || !canSave ? 0.5 : 1 }}>
          {saving ? 'Connecting...' : 'Connect Database'}
        </button>
      </div>
      <button onClick={() => onSkip()} style={s.skipBtn}>Skip for now →</button>
    </div>
  )
}

function StepSharePoint({ onNext, onSkip }) {
  const { instance, accounts } = useMsal()
  const [siteUrl,    setSiteUrl]    = useState('')
  const [connecting, setConnecting] = useState(false)
  const [status,     setStatus]     = useState(null)

  const handleConnect = async () => {
    if (!siteUrl.trim()) return
    setConnecting(true); setStatus(null)
    try {
      let token = null
      if (accounts.length > 0) {
        try { const r = await instance.acquireTokenSilent({ scopes: ['Sites.Read.All'], account: accounts[0] }); token = r.accessToken } catch {}
      }
      await client.post('/sharepoint/save', { site_url: siteUrl.trim(), token })
      setStatus({ ok: true, message: 'SharePoint connected! Documents are being indexed.' })
      setTimeout(() => onNext({ sharepoint: true }), 900)
    }
    catch (e) { setStatus({ ok: false, message: e.response?.data?.detail || 'Connection failed' }) }
    finally { setConnecting(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 style={s.stepTitle}>Connect SharePoint</h2>
        <HelpTooltip title="Azure AD setup required" items={['Register NexusIQ in Azure AD portal', 'Add permission: Sites.Read.All (admin consent)', 'Add permission: Files.Read.All', 'Redirect URI: http://localhost:3000 (SPA type)', 'See the PDF guide for step-by-step instructions']} link={PDF_URL} />
      </div>
      <p style={s.stepDesc}>Paste your SharePoint site URL. NexusIQ will index your documents and answer questions from them.</p>

      <Field label="SharePoint Site URL" tooltip={{ title: 'How to find your site URL', items: ['Go to your SharePoint site in a browser', 'Copy the URL up to /sites/sitename only', 'Example: https://company.sharepoint.com/sites/mysite'], link: PDF_URL }}>
        <Input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://yourcompany.sharepoint.com/sites/yoursite" />
      </Field>

      <div style={{ padding: '11px 14px', borderRadius: 9, background: '#f0f9ff', border: '1px solid #bae6fd', fontSize: 12, color: '#0369a1', marginBottom: 20, lineHeight: 1.6, fontWeight: 500 }}>
        🔒 NexusIQ uses your Microsoft login to access SharePoint — no extra credentials needed.
      </div>

      <StatusMsg status={status} />

      <button onClick={handleConnect} disabled={connecting || !siteUrl.trim()} style={{ ...s.btnPrimary, width: '100%', opacity: connecting || !siteUrl.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
          <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
          <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
          <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
          <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
        </svg>
        {connecting ? 'Connecting...' : 'Connect with Microsoft'}
      </button>
      <button onClick={() => onSkip()} style={s.skipBtn}>Skip for now →</button>
    </div>
  )
}

function StepReady({ connections, onEnter }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 20px', boxShadow: '0 8px 32px rgba(37,99,235,0.25)' }}>🎉</div>
      <h2 style={{ ...s.stepTitle, textAlign: 'center' }}>You're all set!</h2>
      <p style={{ ...s.stepDesc, textAlign: 'center' }}>NexusIQ is ready to answer questions from your connected sources.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '24px 0', textAlign: 'left' }}>
        {[
          { label: 'Database',   connected: connections.db,        Icon: Database    },
          { label: 'SharePoint', connected: connections.sharepoint, Icon: FileText    },
          { label: 'ChromaDB',   connected: true,                   Icon: CheckCircle },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
            <item.Icon size={18} color={item.connected ? '#16a34a' : '#9ca3af'} strokeWidth={2} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', flex: 1 }}>{item.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: item.connected ? '#15803d' : '#9ca3af', background: item.connected ? '#dcfce7' : '#f3f4f6', padding: '3px 10px', borderRadius: 100 }}>
              {item.connected ? 'Connected' : 'Not connected'}
            </span>
          </div>
        ))}
      </div>

      <div style={{ padding: '11px 14px', borderRadius: 9, background: '#f8faff', border: '1px solid #dbeafe', fontSize: 12, color: '#374151', marginBottom: 20, lineHeight: 1.6, fontWeight: 500, textAlign: 'left' }}>
        You can connect or update any data source later from the Settings tab.
      </div>

      <button onClick={onEnter} style={{ ...s.btnPrimary, width: '100%', padding: 14, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        Enter NexusIQ <ChevronRight size={16} />
      </button>
    </div>
  )
}

export default function OnboardingWizard({ onComplete }) {
  const [step,        setStep]        = useState(0)
  const [connections, setConnections] = useState({ db: false, sharepoint: false })

  const handleNext  = (result = {}) => { setConnections(prev => ({ ...prev, ...result })); setStep(p => p + 1) }
  const handleSkip  = () => setStep(p => p + 1)
  const handleEnter = () => { localStorage.setItem('nexusiq_onboarded', 'true'); onComplete() }

  return (
    <div style={{ height: '100vh', display: 'flex', fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>

      {/* Left panel */}
      <div style={{ width: 280, flexShrink: 0, background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 60%, #312e81 100%)', padding: '44px 32px', display: 'flex', flexDirection: 'column' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={16} color="white" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'white', letterSpacing: '-0.4px' }}>
            Nexus<span style={{ color: 'rgba(255,255,255,0.5)' }}>IQ</span>
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 52, fontWeight: 500 }}>Enterprise Knowledge Assistant</div>

        {/* Step list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {STEPS.map(({ label, Icon }, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: i <= step ? 1 : 0.35, transition: 'opacity 0.3s' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: i < step ? '#22c55e' : i === step ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)', border: i === step ? '2px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.1)', transition: 'all 0.3s', flexShrink: 0 }}>
                {i < step ? <CheckCircle size={16} color="white" /> : <Icon size={16} color="white" strokeWidth={2} />}
              </div>
              <span style={{ fontSize: 13, fontWeight: i === step ? 700 : 500, color: i <= step ? 'white' : 'rgba(255,255,255,0.5)' }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 32 }}>
          <a href={PDF_URL} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.85)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
          >
            <FileText size={13} /> View setup guide PDF
          </a>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, overflow: 'auto', background: '#f4f5f7' }}>
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', width: '100%', maxWidth: 560, boxShadow: '0 8px 40px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          {/* Progress bar */}
          <div style={{ height: 3, background: '#f3f4f6' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #2563eb, #7c3aed)', width: `${(step / (STEPS.length - 1)) * 100}%`, transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ padding: '32px 36px' }}>
            {step === 0 && <StepDatabase onNext={handleNext} onSkip={handleSkip} />}
            {step === 1 && <StepSharePoint onNext={handleNext} onSkip={handleSkip} />}
            {step === 2 && <StepReady connections={connections} onEnter={handleEnter} />}
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  stepTitle: { fontSize: 21, fontWeight: 800, color: '#111', letterSpacing: '-0.5px', marginBottom: 8 },
  stepDesc:  { fontSize: 13, color: '#6b7280', lineHeight: 1.65, marginBottom: 24, fontWeight: 500 },
  btnPrimary: { padding: '11px 20px', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', border: 'none', borderRadius: 9, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s' },
  btnOutline: { flex: 1, padding: '11px', border: '1.5px solid #2563eb', borderRadius: 9, background: 'transparent', color: '#2563eb', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  skipBtn:    { display: 'block', width: '100%', marginTop: 14, padding: '9px', background: 'none', border: 'none', color: '#9ca3af', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', fontWeight: 500 },
}