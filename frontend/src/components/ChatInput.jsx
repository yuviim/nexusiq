import { useState, useRef } from 'react'
import { Send, Square } from 'lucide-react'

export default function ChatInput({ onSend, loading }) {
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)

  const handleSend = () => {
    if (!value.trim() || loading) return
    onSend(value.trim())
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleChange = (e) => {
    setValue(e.target.value)
    // Auto-grow textarea
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
    }
  }

  const canSend = value.trim() && !loading

  return (
    <div style={{
      padding: '12px 24px 18px',
      borderTop: '1px solid #e5e7eb',
      background: 'white',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex', gap: 10, alignItems: 'flex-end',
        background: '#f9fafb',
        border: '1.5px solid #e5e7eb',
        borderRadius: 14,
        padding: '10px 10px 10px 16px',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
        onFocusCapture={e => {
          e.currentTarget.style.borderColor = '#2563eb'
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.08)'
          e.currentTarget.style.background = 'white'
        }}
        onBlurCapture={e => {
          e.currentTarget.style.borderColor = '#e5e7eb'
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.background = '#f9fafb'
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
          }}
          disabled={loading}
          rows={1}
          placeholder="Ask anything about your data and documents..."
          style={{
            flex: 1, background: 'none', border: 'none',
            color: '#111',
            fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
            fontSize: 14, fontWeight: 500,
            outline: 'none', resize: 'none', lineHeight: 1.6,
            paddingTop: 2, paddingBottom: 2,
            maxHeight: 160, overflow: 'auto',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: canSend
              ? 'linear-gradient(135deg, #2563eb, #7c3aed)'
              : '#f3f4f6',
            border: 'none',
            cursor: canSend ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
            boxShadow: canSend ? '0 2px 8px rgba(37,99,235,0.3)' : 'none',
          }}
        >
          {loading ? (
            <div style={{
              width: 14, height: 14,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: 'white',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          ) : (
            <Send size={15} color={canSend ? 'white' : '#9ca3af'} strokeWidth={2.5} />
          )}
        </button>
      </div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 7, textAlign: 'center', fontWeight: 500 }}>
        Enter to send · Shift+Enter for new line
      </div>
    </div>
  )
}