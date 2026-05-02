import { useState, useRef, useEffect } from 'react'

export default function HelpTooltip({ title, items, link }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid var(--border)', background: open ? 'var(--accent)' : 'var(--bg-secondary)', color: open ? 'white' : 'var(--text-muted)', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}
        onMouseEnter={e => { if (!open) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' } }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' } }}
      >?</button>
      {open && (
        <div style={{ position: 'absolute', top: 24, left: 0, zIndex: 1000, background: 'white', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '16px', width: 280 }}>
          {title && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>{title}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'white', background: 'var(--accent)', borderRadius: '50%', width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{i + 1}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
          {link && (
            <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }} onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }} onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}>
                View full setup guide
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
