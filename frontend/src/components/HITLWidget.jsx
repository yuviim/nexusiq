import { useState } from 'react'
import CitationPanel from './CitationPanel'
import { renderMarkdown } from '../utils/markdown'

export default function HITLWidget({ payload, onAction, loading }) {
  const [edited, setEdited] = useState(payload?.answer_draft || '')

  return (
    <div style={{
      background: 'white',
      border: '1px solid var(--warning)',
      borderRadius: 12,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      animation: 'fadeIn 0.3s ease',
      boxShadow: '0 4px 16px rgba(217,119,6,0.08)',
      marginBottom: 20,
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: '#fffbeb',
          border: '1px solid #fcd34d',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, flexShrink: 0,
        }}>
          ⚠️
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
            Human review required
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
            This answer has low confidence and needs your approval before being shown
          </div>
        </div>
        <div style={{
          marginLeft: 'auto', flexShrink: 0,
          fontSize: 12, fontWeight: 600,
          color: 'var(--warning)',
          background: '#fffbeb',
          padding: '4px 10px', borderRadius: 6,
          border: '1px solid #fcd34d',
        }}>
          {((payload?.confidence || 0) * 100).toFixed(0)}% confidence
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)' }} />

      {/* Draft answer label */}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
        Draft Answer
      </div>

        {/* Draft answer content */}
        <div
        className="md-content"
        style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '14px 16px',
            fontSize: 13,
            lineHeight: 1.7,
        }}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(payload?.answer_draft || '') }}
        />

      {/* Citations */}
      <CitationPanel citations={payload?.citations} />

      {/* Edit label */}
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
        Edit Answer (optional)
      </div>

      {/* Edit textarea */}
      <textarea
        value={edited}
        onChange={e => setEdited(e.target.value)}
        rows={4}
        placeholder="Edit the answer above before approving, or leave as-is and click Approve..."
        style={{
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: 8,
          color: 'var(--text-primary)',
          fontFamily: 'Inter, sans-serif',
          fontSize: 13,
          lineHeight: 1.6,
          padding: '10px 14px',
          resize: 'vertical',
          outline: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          width: '100%',
        }}
        onFocus={e => {
          e.target.style.borderColor = 'var(--accent)'
          e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.08)'
        }}
        onBlur={e => {
          e.target.style.borderColor = 'var(--border)'
          e.target.style.boxShadow = 'none'
        }}
      />

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>

        {/* Approve */}
        <button
          onClick={() => onAction('approve', null)}
          disabled={loading}
          style={{
            flex: 1,
            background: loading ? 'var(--bg-secondary)' : '#f0fdf4',
            border: '1px solid var(--success)',
            borderRadius: 8,
            color: 'var(--success)',
            fontSize: 13, fontWeight: 500,
            padding: '10px 8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: loading ? 0.5 : 1,
            transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
          onMouseEnter={e => !loading && (e.currentTarget.style.background = '#dcfce7')}
          onMouseLeave={e => !loading && (e.currentTarget.style.background = '#f0fdf4')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Approve
        </button>

        {/* Approve with edits */}
        <button
          onClick={() => onAction('edit', edited)}
          disabled={loading}
          style={{
            flex: 1.5,
            background: loading ? 'var(--bg-secondary)' : '#eff6ff',
            border: '1px solid var(--accent)',
            borderRadius: 8,
            color: 'var(--accent)',
            fontSize: 13, fontWeight: 500,
            padding: '10px 8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: loading ? 0.5 : 1,
            transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
          onMouseEnter={e => !loading && (e.currentTarget.style.background = '#dbeafe')}
          onMouseLeave={e => !loading && (e.currentTarget.style.background = '#eff6ff')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Approve with edits
        </button>

        {/* Reject */}
        <button
          onClick={() => onAction('reject', null)}
          disabled={loading}
          style={{
            flex: 1,
            background: loading ? 'var(--bg-secondary)' : '#fef2f2',
            border: '1px solid var(--danger)',
            borderRadius: 8,
            color: 'var(--danger)',
            fontSize: 13, fontWeight: 500,
            padding: '10px 8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: loading ? 0.5 : 1,
            transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
          onMouseEnter={e => !loading && (e.currentTarget.style.background = '#fee2e2')}
          onMouseLeave={e => !loading && (e.currentTarget.style.background = '#fef2f2')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Reject
        </button>

      </div>

      {/* Helper text */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        Approved answers are shown to the user · Rejected answers are discarded
      </div>

    </div>
  )
}