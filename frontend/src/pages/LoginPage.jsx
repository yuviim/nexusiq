import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [msalLoading, setMsalLoading] = useState(false)
  const { login, loginWithMicrosoft } = useAuth()
  const toast = useToast()

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return
    setLoading(true)
    try {
      await login(username.trim(), password.trim())
      toast.success('Welcome to NexusIQ!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

    const handleMicrosoft = async () => {
    setMsalLoading(true)
    try {
        await loginWithMicrosoft()
        // Page redirects to Microsoft — code below never runs
    } catch (err) {
        console.log('MSAL error:', err)
        console.log('Error code:', err?.errorCode)
        console.log('Error name:', err?.name)
        if (err?.errorCode !== 'user_cancelled' && err?.name !== 'BrowserAuthError') {
        toast.error('Microsoft sign-in failed. Please try again.')
        }
        setMsalLoading(false)
    }
    }

  return (
    <div style={{
      height: '100vh', display: 'flex',
      background: 'var(--bg-secondary)',
    }}>
      {/* Left panel */}
      <div style={{
        flex: 1, background: 'linear-gradient(135deg, #1e3a8a 0%, #4c1d95 100%)',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -100, right: -100,
          width: 400, height: 400, borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: -60,
          width: 300, height: 300, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
        }} />

        <div style={{ marginBottom: 48, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 800, color: 'white',
            }}>N</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>
              NexusIQ
            </div>
          </div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', fontWeight: 400 }}>
            Enterprise Knowledge Assistant
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'relative' }}>
          {[
            { icon: '⚡', title: 'Instant answers', desc: 'Query your documents and databases in plain English' },
            { icon: '🔒', title: 'Enterprise secure', desc: 'Your data stays in your infrastructure, always' },
            { icon: '🧠', title: 'Multi-agent AI', desc: 'Powered by Claude with LangGraph orchestration' },
          ].map(item => (
            <div key={item.title} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}>{item.icon}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'white', marginBottom: 3 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{
        width: 480, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px 48px',
        background: 'white',
      }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.5px' }}>
            Welcome back
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Sign in to your NexusIQ workspace
          </div>
        </div>

        {/* Microsoft SSO button */}
        <button
          onClick={handleMicrosoft}
          disabled={msalLoading}
          style={{
            width: '100%', padding: '11px 14px',
            background: 'white',
            border: '1.5px solid #e2e8f0',
            borderRadius: 10, fontSize: 14, fontWeight: 600,
            color: '#0f172a', cursor: msalLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            marginBottom: 20,
            opacity: msalLoading ? 0.7 : 1,
          }}
          onMouseEnter={e => {
            if (!msalLoading) e.currentTarget.style.borderColor = '#2563eb'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#e2e8f0'
          }}
        >
          {/* Microsoft logo SVG */}
          <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
            <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
            <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
          </svg>
          {msalLoading ? 'Signing in...' : 'Sign in with Microsoft'}
        </button>

        {/* Divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
            or continue with demo
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* Demo login form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Username
            </label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              style={{
                width: '100%', padding: '11px 14px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 10, fontSize: 14,
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                outline: 'none', transition: 'all 0.15s',
                boxSizing: 'border-box',
              }}
              onFocus={e => {
                e.target.style.borderColor = 'var(--accent)'
                e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.08)'
                e.target.style.background = 'white'
              }}
              onBlur={e => {
                e.target.style.borderColor = 'var(--border)'
                e.target.style.boxShadow = 'none'
                e.target.style.background = 'var(--bg-secondary)'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              style={{
                width: '100%', padding: '11px 14px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 10, fontSize: 14,
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                outline: 'none', transition: 'all 0.15s',
                boxSizing: 'border-box',
              }}
              onFocus={e => {
                e.target.style.borderColor = 'var(--accent)'
                e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.08)'
                e.target.style.background = 'white'
              }}
              onBlur={e => {
                e.target.style.borderColor = 'var(--border)'
                e.target.style.boxShadow = 'none'
                e.target.style.background = 'var(--bg-secondary)'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            style={{
              width: '100%', padding: '12px',
              background: loading || !username.trim() || !password.trim()
                ? 'var(--bg-hover)' : 'linear-gradient(135deg, #2563eb, #7c3aed)',
              border: 'none', borderRadius: 10,
              color: loading || !username.trim() || !password.trim()
                ? 'var(--text-muted)' : 'white',
              fontSize: 14, fontWeight: 600,
              cursor: loading || !username.trim() || !password.trim()
                ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s', marginTop: 4,
              boxShadow: loading || !username.trim() || !password.trim()
                ? 'none' : '0 4px 14px rgba(37,99,235,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: 14, height: 14,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                Signing in...
              </>
            ) : 'Sign in →'}
          </button>
        </form>

        {/* Demo credentials */}
        <div style={{
          marginTop: 24, padding: '14px 16px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Demo credentials
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, fontFamily: 'JetBrains Mono, monospace' }}>
            Username: <strong>yuvaraj</strong><br />
            Password: <strong>nexusiq2026</strong>
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 32, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          NexusIQ Enterprise · Powered by Claude
        </div>
      </div>
    </div>
  )
}