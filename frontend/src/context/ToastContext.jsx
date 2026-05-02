import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error:   (msg, dur) => addToast(msg, 'error',   dur),
    info:    (msg, dur) => addToast(msg, 'info',     dur),
    warning: (msg, dur) => addToast(msg, 'warning',  dur),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

function ToastContainer({ toasts }) {
  if (toasts.length === 0) return null

  const colors = {
    success: { bg: '#f0fdf4', border: '#86efac', color: '#166534', icon: '✓' },
    error:   { bg: '#fef2f2', border: '#fca5a5', color: '#991b1b', icon: '✕' },
    info:    { bg: '#eff6ff', border: '#93c5fd', color: '#1e40af', icon: 'ℹ' },
    warning: { bg: '#fffbeb', border: '#fcd34d', color: '#92400e', icon: '⚠' },
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 9999,
    }}>
      {toasts.map(toast => {
        const c = colors[toast.type] || colors.info
        return (
          <div key={toast.id} style={{
            background: c.bg,
            border: `1px solid ${c.border}`,
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            animation: 'fadeIn 0.2s ease',
            minWidth: 280, maxWidth: 380,
          }}>
            <span style={{
              width: 20, height: 20, borderRadius: '50%',
              background: c.border,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: c.color, flexShrink: 0,
            }}>
              {c.icon}
            </span>
            <span style={{ fontSize: 13, color: c.color, fontWeight: 500, lineHeight: 1.4 }}>
              {toast.message}
            </span>
          </div>
        )
      })}
    </div>
  )
}