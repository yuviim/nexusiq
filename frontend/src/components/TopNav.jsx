import { useState } from 'react'
import { LayoutGrid, MessageSquare, Upload, BookOpen, Settings, Zap, ChevronDown, LogOut } from 'lucide-react'
import DBSwitcher from './DBSwitcher'

const NAV_ITEMS = [
  { id: 'home',      label: 'Home',      Icon: LayoutGrid,    iconBg: 'rgba(99,102,241,0.4)',  iconBgActive: 'rgba(99,102,241,0.65)'  },
  { id: 'chat',      label: 'Chat',      Icon: MessageSquare, iconBg: 'rgba(16,185,129,0.4)',  iconBgActive: 'rgba(16,185,129,0.65)'  },
  { id: 'data',      label: 'Data',      Icon: Upload,        iconBg: 'rgba(245,158,11,0.4)',  iconBgActive: 'rgba(245,158,11,0.65)'  },
  { id: 'knowledge', label: 'Knowledge', Icon: BookOpen,      iconBg: 'rgba(139,92,246,0.4)',  iconBgActive: 'rgba(139,92,246,0.65)'  },
  { id: 'settings',  label: 'Settings',  Icon: Settings,      iconBg: 'rgba(239,68,68,0.3)',   iconBgActive: 'rgba(239,68,68,0.5)'    },
]

export default function TopNav({ activeTab, onTabChange, user, onLogout }) {
  const [showMenu, setShowMenu] = useState(false)

  // Listen for nav events from DBSwitcher
  useState(() => {
    const handler = (e) => { if (e.detail) onTabChange(e.detail) }
    document.addEventListener('nexusiq:nav', handler)
    return () => document.removeEventListener('nexusiq:nav', handler)
  })

  return (
    <div style={{
      height: 56,
      background: 'linear-gradient(135deg, #1e1b4b 0%, #2563eb 60%, #7c3aed 100%)',
      display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: 0, flexShrink: 0,
      position: 'relative', zIndex: 100,
    }}>

      {/* Logo */}
      <a
        href="/#landing"
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', gap: 9, marginRight: 24, flexShrink: 0, textDecoration: 'none', cursor: 'pointer' }}
      >
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={15} color="white" strokeWidth={2.5} />
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.4px', color: 'white' }}>
          Nexus<span style={{ color: 'rgba(255,255,255,0.6)' }}>IQ</span>
        </span>
      </a>

      {/* Nav tabs */}
      <div style={{ display: 'flex', gap: 2, flex: 1 }}>
        {NAV_ITEMS.map(({ id, label, Icon, iconBg, iconBgActive }) => {
          const active = activeTab === id
          return (
            <button key={id} onClick={() => onTabChange(id)} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 14px', borderRadius: 8, border: 'none',
              background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 600,
              color: active ? 'white' : 'rgba(255,255,255,0.72)',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'white' } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.72)' } }}
            >
              <div style={{ width: 26, height: 26, borderRadius: 7, background: active ? iconBgActive : iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>
                <Icon size={14} color="white" strokeWidth={2.2} />
              </div>
              {label}
            </button>
          )
        })}
      </div>

      {/* Right side — DB Switcher + User menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>

        {/* DB Switcher */}
        <DBSwitcher onSwitch={(conn) => console.log('Switched to:', conn)} />

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)' }} />

        {/* User menu */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowMenu(o => !o)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 10px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.1)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white' }}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>{user?.name || 'User'}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.username || ''}</div>
            </div>
            <ChevronDown size={11} color="rgba(255,255,255,0.6)" />
          </button>

          {showMenu && (
            <div style={{ position: 'absolute', top: 46, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 180, zIndex: 200, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{user?.name}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{user?.username}</div>
              </div>
              <button
                onClick={() => { setShowMenu(false); onLogout() }}
                style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'none', color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}