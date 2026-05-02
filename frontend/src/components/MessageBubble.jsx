import { useState } from 'react'
import { ThumbsUp, ThumbsDown, Clock, CheckCircle } from 'lucide-react'
import CitationPanel from './CitationPanel'
import { renderMarkdown } from '../utils/markdown'
import client from '../api/client'

const ConfidenceBadge = ({ value }) => {
  const pct   = Math.round((value || 0) * 100)
  const color = pct >= 75 ? '#15803d' : pct >= 50 ? '#b45309' : '#dc2626'
  const bg    = pct >= 75 ? '#dcfce7' : pct >= 50 ? '#fef3c7' : '#fee2e2'
  const bc    = pct >= 75 ? '#bbf7d0' : pct >= 50 ? '#fde68a' : '#fecaca'
  return (
    <span style={{
      fontSize: 11, color, background: bg,
      border: `1px solid ${bc}`, borderRadius: 20,
      padding: '2px 9px', fontWeight: 700,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      {pct}% confidence
    </span>
  )
}

const TimeBadge = ({ ms }) => {
  if (!ms) return null
  const label = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
  return (
    <span style={{
      fontSize: 11, color: '#9ca3af',
      background: '#f9fafb', border: '1px solid #e5e7eb',
      borderRadius: 20, padding: '2px 8px',
      display: 'flex', alignItems: 'center', gap: 4,
      fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500,
    }}>
      <Clock size={10} strokeWidth={2} />
      {label}
    </span>
  )
}

function FeedbackBar({ messageId, sessionId }) {
  const [voted,      setVoted]      = useState(null)
  const [showReason, setShowReason] = useState(false)
  const [reason,     setReason]     = useState('')
  const [submitted,  setSubmitted]  = useState(false)

  const handleVote = async (vote) => {
    if (voted) return
    setVoted(vote)
    if (vote === 'down') {
      setShowReason(true)
    } else {
      try { await client.post('/feedback', { message_id: messageId, session_id: sessionId, vote: 'up', reason: '' }) } catch {}
      setSubmitted(true)
    }
  }

  const handleSubmitReason = async () => {
    try { await client.post('/feedback', { message_id: messageId, session_id: sessionId, vote: 'down', reason }) } catch {}
    setShowReason(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9ca3af', paddingLeft: 2, fontWeight: 500 }}>
        <CheckCircle size={12} color={voted === 'up' ? '#16a34a' : '#f59e0b'} />
        {voted === 'up' ? 'Thanks for the feedback!' : "Feedback noted — we'll improve."}
      </div>
    )
  }

  return (
    <div style={{ paddingLeft: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>Was this helpful?</span>
        <button onClick={() => handleVote('up')} disabled={!!voted} style={{
          background: voted === 'up' ? '#f0fdf4' : 'white',
          border: voted === 'up' ? '1px solid #bbf7d0' : '1px solid #e5e7eb',
          borderRadius: 7, padding: '4px 10px', cursor: voted ? 'default' : 'pointer',
          fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
          color: voted === 'up' ? '#15803d' : '#6b7280',
          display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit',
        }}
          onMouseEnter={e => { if (!voted) { e.currentTarget.style.borderColor = '#16a34a'; e.currentTarget.style.color = '#15803d' } }}
          onMouseLeave={e => { if (!voted) { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280' } }}
        >
          <ThumbsUp size={12} strokeWidth={2} /> Yes
        </button>
        <button onClick={() => handleVote('down')} disabled={!!voted} style={{
          background: voted === 'down' ? '#fef2f2' : 'white',
          border: voted === 'down' ? '1px solid #fecaca' : '1px solid #e5e7eb',
          borderRadius: 7, padding: '4px 10px', cursor: voted ? 'default' : 'pointer',
          fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
          color: voted === 'down' ? '#dc2626' : '#6b7280',
          display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit',
        }}
          onMouseEnter={e => { if (!voted) { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#dc2626' } }}
          onMouseLeave={e => { if (!voted) { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280' } }}
        >
          <ThumbsDown size={12} strokeWidth={2} /> No
        </button>
      </div>

      {showReason && (
        <div style={{ marginTop: 10, background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', maxWidth: 360 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10 }}>What went wrong?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {['Wrong answer', 'Incomplete answer', 'Wrong source cited', 'Too vague', 'Other'].map(option => (
              <button key={option} onClick={() => setReason(option)} style={{
                textAlign: 'left', padding: '7px 11px', borderRadius: 7,
                fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                border: reason === option ? '1.5px solid #2563eb' : '1px solid #e5e7eb',
                background: reason === option ? '#eff6ff' : '#f9fafb',
                color: reason === option ? '#2563eb' : '#374151',
              }}>
                {option}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSubmitReason} disabled={!reason} style={{
              flex: 1, padding: '8px', background: reason ? 'linear-gradient(135deg, #2563eb, #7c3aed)' : '#f3f4f6',
              border: 'none', borderRadius: 8, color: reason ? 'white' : '#9ca3af',
              fontSize: 12, fontWeight: 700, cursor: reason ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            }}>
              Submit
            </button>
            <button onClick={() => { setShowReason(false); setVoted(null) }} style={{
              padding: '8px 14px', background: 'none', border: '1px solid #e5e7eb',
              borderRadius: 8, fontSize: 12, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MessageBubble({ message, sessionId }) {
  if (!message) return null
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20, animation: 'fadeIn 0.2s ease' }}>
        <div style={{
          maxWidth: '65%',
          background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
          borderRadius: '16px 16px 4px 16px',
          padding: '11px 16px',
          fontSize: 14, lineHeight: 1.6, color: 'white', fontWeight: 500,
          boxShadow: '0 2px 12px rgba(37,99,235,0.25)',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 24, animation: 'fadeIn 0.2s ease' }}>
      <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 2 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: 'white', fontWeight: 800,
          }}>N</div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            NexusIQ
          </span>
          {message.confidence != null && <ConfidenceBadge value={message.confidence} />}
          {message.responseTime != null && <TimeBadge ms={message.responseTime} />}
        </div>

        {/* Content bubble */}
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '4px 16px 16px 16px',
          padding: '16px 20px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          <div
            className="md-content"
            style={{ fontSize: 14, lineHeight: 1.75, color: '#111', fontWeight: 500 }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
        </div>

        <CitationPanel citations={message.citations} />

        <FeedbackBar messageId={message.message_id} sessionId={sessionId} />
      </div>
    </div>
  )
}