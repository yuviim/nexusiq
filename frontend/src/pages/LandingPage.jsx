// frontend/src/pages/LandingPage.jsx
import { useEffect, useState } from 'react'
import { Zap, LayoutGrid, MessageSquare, Upload, BookOpen, Settings } from 'lucide-react'

const FEATURES = [
  {
    icon: '📄',
    title: 'SharePoint Documents',
    description: 'Ask questions across all your SharePoint libraries. NexusIQ retrieves, ranks, and cites the exact document — no manual search.',
    tag: 'RAG + MCP',
    color: '#0078d4',
  },
  {
    icon: '🗄️',
    title: 'SQL & Analytics Databases',
    description: 'Plain English becomes SQL. Query MySQL, Snowflake, Databricks, PostgreSQL, Exasol, or Redshift — formatted tables with full citations.',
    tag: 'Text-to-SQL',
    color: '#1d9e75',
  },
  {
    icon: '🔍',
    title: 'Vector Search',
    description: 'Semantic search over ingested documents via ChromaDB. Surface the most relevant knowledge even when keywords don\'t match.',
    tag: 'ChromaDB',
    color: '#7c3aed',
  },
]

const DB_LOGOS = [
  { name: 'Snowflake',  color: '#29b6f6', icon: '❄️' },
  { name: 'Databricks', color: '#ff7518', icon: '🧱' },
  { name: 'MySQL',      color: '#1d9e75', icon: '🗄️' },
  { name: 'PostgreSQL', color: '#336791', icon: '🐘' },
  { name: 'Exasol',     color: '#6d28d9', icon: '⚡' },
  { name: 'Redshift',   color: '#8c4fff', icon: '🔴' },
]

const PLANS = [
  { name: 'Starter',      price: '$49',   period: '/mo', description: 'For individuals and small teams exploring AI-powered knowledge.', features: ['1 data source', 'Up to 5 users', '10,000 queries/month', 'ChromaDB RAG', 'Email support'],                                                              cta: 'Start free trial', highlight: false },
  { name: 'Professional', price: '$199',  period: '/mo', description: 'For teams that need multi-source intelligence at scale.',          features: ['3 data sources', 'Up to 50 users', '100,000 queries/month', 'SharePoint + SQL + RAG', 'Azure AD SSO', 'Priority support'],                         cta: 'Start free trial', highlight: true  },
  { name: 'Enterprise',   price: 'Custom',period: '',    description: 'For large organisations needing custom deployment and SLAs.',      features: ['Unlimited data sources', 'Unlimited users', 'Unlimited queries', 'On-premise or VNet', 'SAML / OIDC SSO', 'Dedicated CSM', 'SLA guarantee'], cta: 'Contact sales',   highlight: false },
]

const STATS = [
  { value: '10x',  label: 'Faster than manual search' },
  { value: '95%',  label: 'Query accuracy'             },
  { value: '<2s',  label: 'Average response time'      },
  { value: 'SOC2', label: 'Type II certified'          },
]

const TRUST = [
  { name: 'SOC 2 Type II', icon: '🔒' },
  { name: 'GDPR Ready',    icon: '🇪🇺' },
  { name: 'Azure Certified',icon: '☁️' },
  { name: 'ISO 27001',     icon: '🛡️' },
]

const NAV_ITEMS = [
  { label: 'Home',      Icon: LayoutGrid,    iconBg: 'rgba(99,102,241,0.4)'  },
  { label: 'Chat',      Icon: MessageSquare, iconBg: 'rgba(16,185,129,0.4)'  },
  { label: 'Data',      Icon: Upload,        iconBg: 'rgba(245,158,11,0.4)'  },
  { label: 'Knowledge', Icon: BookOpen,      iconBg: 'rgba(139,92,246,0.4)'  },
  { label: 'Settings',  Icon: Settings,      iconBg: 'rgba(239,68,68,0.3)'   },
]

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const go = (path) => { window.location.href = path }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', 'DM Sans', system-ui, sans-serif", color: '#0f172a', background: '#ffffff', minHeight: '100vh' }}>

      {/* ── GRADIENT NAV ── */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, height: 56, background: 'linear-gradient(135deg, #1e1b4b 0%, #2563eb 60%, #7c3aed 100%)', display: 'flex', alignItems: 'center', padding: '0 24px', transition: 'box-shadow 0.3s', boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,0.3)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginRight: 32, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={15} color="white" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.4px', color: 'white' }}>Nexus<span style={{ color: 'rgba(255,255,255,0.6)' }}>IQ</span></span>
        </div>
        <div style={{ display: 'flex', gap: 2, flex: 1 }}>
          {NAV_ITEMS.map(({ label, Icon, iconBg }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={14} color="white" strokeWidth={2.2} />
              </div>
              {label}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={() => window.location.href = '/'} style={{ padding: '7px 16px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, background: 'transparent', fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Sign in</button>
          <button onClick={() => window.location.href = '/'}style={{ padding: '7px 18px', border: 'none', borderRadius: 8, background: 'white', color: '#2563eb', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Get started free →</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 2rem 60px', gap: '4rem', flexWrap: 'wrap', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 60% 40%, rgba(124,58,237,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 560, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 100, padding: '6px 16px', fontSize: 13, color: '#a5b4fc', marginBottom: 28, fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            Now available on Microsoft AppSource
          </div>
          <h1 style={{ fontSize: 'clamp(36px, 5vw, 58px)', fontWeight: 800, lineHeight: 1.1, color: '#f8fafc', marginBottom: 24, letterSpacing: '-1.5px' }}>
            Ask anything.<br />
            <span style={{ background: 'linear-gradient(90deg, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Get answers from your data.</span>
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: '#94a3b8', marginBottom: 36, fontWeight: 500 }}>
            NexusIQ is an enterprise AI assistant that unifies SharePoint documents, SQL databases, and vector search — answering plain English questions with cited, auditable responses.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <button onClick={() => window.location.hash = '#app'} style={{ padding: '14px 28px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Start free trial</button>
            <button style={{ padding: '14px 28px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, color: '#e2e8f0', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Watch 2-min demo ▶</button>
          </div>
          <p style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>No credit card required · Deploys in under 10 minutes</p>

          {/* DB logos row */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 32 }}>
            {DB_LOGOS.map(db => (
              <div key={db.name} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '5px 10px' }}>
                <span style={{ fontSize: 14 }}>{db.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{db.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Mockup */}
        <div style={{ width: 480, background: '#1e293b', borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.5)', position: 'relative', zIndex: 1, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', background: '#0f172a', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {['#ef4444','#f59e0b','#10b981'].map(c => <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />)}
            <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8, fontWeight: 500 }}>NexusIQ · Knowledge Assistant</span>
          </div>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ alignSelf: 'flex-end', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', padding: '10px 16px', borderRadius: '12px 12px 4px 12px', fontSize: 13, maxWidth: '80%', fontWeight: 500 }}>
              Who are the top 5 sales reps this quarter?
            </div>
            <div style={{ background: '#0f172a', borderRadius: '4px 12px 12px 12px', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', width: 22, height: 22, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>N</span>
                <span style={{ fontSize: 11, background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '3px 8px', borderRadius: 100, fontWeight: 700 }}>87% confidence</span>
                <span style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>⏱ 1.8s</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr>{['Rank','Rep','Revenue','Orders'].map(h => <th key={h} style={{ color: '#64748b', textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {[['1','Traci Clark','$21.3M','69'],['2','D. Davis','$20.9M','66'],['3','J. Guerrero','$18.0M','53']].map(([r,n,v,o]) => (
                    <tr key={r}>{[r,n,v,o].map((c,i) => <td key={i} style={{ color: '#e2e8f0', padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontWeight: 500 }}>{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 10, fontSize: 11, color: '#475569', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, fontWeight: 500 }}>📎 Source: SQL MCP → nexusiq.sales_orders</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
        {STATS.map(s => (
          <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 48px', borderRight: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: '#4f46e5', letterSpacing: '-1px' }}>{s.value}</span>
            <span style={{ fontSize: 13, color: '#64748b', marginTop: 4, fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: '80px 2rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>Capabilities</p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-1px', marginBottom: 16, lineHeight: 1.15 }}>One assistant. Every data source.</h2>
          <p style={{ fontSize: 17, color: '#64748b', maxWidth: 600, lineHeight: 1.7, marginBottom: 40, fontWeight: 500 }}>NexusIQ's multi-agent architecture routes each query to the right source and synthesises a single, cited answer.</p>

          {/* DB support logos */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 48, padding: '16px 20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', alignSelf: 'center', marginRight: 4 }}>Supported databases:</span>
            {DB_LOGOS.map(db => (
              <div key={db.name} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 12px' }}>
                <span style={{ fontSize: 14 }}>{db.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: db.color }}>{db.name}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16, background: f.color + '18' }}>{f.icon}</div>
                <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, marginBottom: 12, color: f.color, background: f.color + '14', letterSpacing: '0.5px' }}>{f.tag}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.65, fontWeight: 500 }}>{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ARCHITECTURE ── */}
      <section style={{ background: '#0f172a', padding: '80px 2rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>Architecture</p>
            <h2 style={{ fontSize: 'clamp(28px,3.5vw,40px)', fontWeight: 800, color: '#f8fafc', letterSpacing: '-1px', lineHeight: 1.15, marginBottom: 20 }}>Built on LangGraph.<br />Powered by Claude.</h2>
            <p style={{ fontSize: 15, color: '#94a3b8', lineHeight: 1.7, marginBottom: 24, fontWeight: 500 }}>A LangGraph supervisor routes queries to specialist agents — SharePoint MCP, SQL MCP, and ChromaDB RAG — then synthesises responses with confidence scores and full citations.</p>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {['FastMCP transport layer for low-latency data access', 'Multi-database: Snowflake, Databricks, MySQL, Exasol + more', 'Confidence scoring on every response', 'Audit trail with full SQL and document citations'].map(item => (
                <li key={item} style={{ fontSize: 14, color: '#94a3b8', display: 'flex', alignItems: 'flex-start', gap: 8, fontWeight: 500 }}>
                  <span style={{ color: '#818cf8', fontWeight: 700, flexShrink: 0 }}>✓</span> {item}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            {[{ icon: '💬', label: 'User Query', h: false }, { icon: '🧠', label: 'LangGraph Supervisor', h: true }].map(n => (
              <div key={n.label}>
                <div style={{ background: n.h ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)', border: `1px solid ${n.h ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 12, padding: '14px 28px', textAlign: 'center', width: 200 }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{n.icon}</div>
                  <div style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 600 }}>{n.label}</div>
                </div>
                <div style={{ color: '#475569', fontSize: 20, textAlign: 'center', margin: '4px 0' }}>↓</div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 12 }}>
              {[{ icon: '📄', label: 'SharePoint\nMCP' }, { icon: '🗄️', label: 'SQL\nMCP' }, { icon: '🔍', label: 'ChromaDB\nRAG' }].map(n => (
                <div key={n.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 16px', textAlign: 'center', width: 90 }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{n.icon}</div>
                  <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 600, whiteSpace: 'pre' }}>{n.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section style={{ padding: '80px 2rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>Pricing</p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-1px', marginBottom: 16 }}>Simple, transparent pricing</h2>
          <p style={{ fontSize: 17, color: '#64748b', maxWidth: 600, lineHeight: 1.7, marginBottom: 56, fontWeight: 500 }}>Start free. Scale as you grow. Enterprise deployments on AWS, Azure, and Microsoft AppSource.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, alignItems: 'start' }}>
            {PLANS.map(plan => (
              <div key={plan.name} style={{ background: '#fff', border: plan.highlight ? '2px solid #4f46e5' : '1px solid #e2e8f0', borderRadius: 20, padding: 32, position: 'relative', boxShadow: plan.highlight ? '0 8px 40px rgba(79,70,229,0.15)' : 'none' }}>
                {plan.highlight && <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 16px', borderRadius: 100, whiteSpace: 'nowrap' }}>Most popular</div>}
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>{plan.name}</h3>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 12 }}>
                  <span style={{ fontSize: 42, fontWeight: 800, color: '#0f172a', letterSpacing: '-1.5px' }}>{plan.price}</span>
                  <span style={{ fontSize: 16, color: '#64748b', fontWeight: 500 }}>{plan.period}</span>
                </div>
                <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 24, borderBottom: '1px solid #f1f5f9', paddingBottom: 20, fontWeight: 500 }}>{plan.description}</p>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ fontSize: 14, color: '#374151', display: 'flex', gap: 8, fontWeight: 500 }}>
                      <span style={{ color: '#10b981', fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => go('/login')} style={{ width: '100%', padding: 13, borderRadius: 10, border: plan.highlight ? 'none' : '1.5px solid #4f46e5', background: plan.highlight ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'transparent', color: plan.highlight ? '#fff' : '#4f46e5', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST ── */}
      <section style={{ background: '#f8fafc', padding: '64px 2rem', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>Security & compliance</p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-1px', marginBottom: 40 }}>Enterprise-grade security, always</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
            {TRUST.map(t => (
              <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 28px' }}>
                <span style={{ fontSize: 22 }}>{t.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>{t.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)', padding: '80px 2rem', textAlign: 'center' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, color: '#f8fafc', letterSpacing: '-1px', marginBottom: 16 }}>Ready to unify your enterprise knowledge?</h2>
          <p style={{ fontSize: 17, color: '#94a3b8', marginBottom: 36, fontWeight: 500 }}>Deploy in minutes. No data leaves your infrastructure.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => go('/login')} style={{ padding: '14px 28px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Start free trial</button>
            <button style={{ padding: '14px 28px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, color: '#e2e8f0', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Book a demo</button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#0f172a', padding: '40px 2rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={15} color="white" strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'white', letterSpacing: '-0.4px' }}>Nexus<span style={{ color: 'rgba(255,255,255,0.5)' }}>IQ</span></span>
          </div>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {['Privacy policy','Terms of service','Documentation','Status'].map(l => (
              <a key={l} href="#" style={{ fontSize: 13, color: '#64748b', textDecoration: 'none', fontWeight: 500 }}>{l}</a>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#334155', fontWeight: 500 }}>© 2026 NexusIQ · Available on Microsoft AppSource & AWS Marketplace</p>
        </div>
      </footer>
    </div>
  )
}