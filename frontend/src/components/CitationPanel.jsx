import { useState } from 'react'

const typeConfig = {
  sql:        { color: 'var(--sql-color)', bg: '#f0fdf4', label: 'SQL',        icon: '⬡' },
  rag:        { color: 'var(--rag-color)', bg: '#eff6ff', label: 'Document',   icon: '◈' },
  sharepoint: { color: 'var(--sp-color)', bg: '#faf5ff', label: 'SharePoint', icon: '◉' },
}

function PageBadge({ page, chunkIndex, totalChunks }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
      {page && (
        <span style={{
          fontSize: 10, fontWeight: 600, color: '#4f46e5',
          background: 'rgba(79,70,229,0.08)',
          border: '1px solid rgba(79,70,229,0.2)',
          padding: '2px 8px', borderRadius: 100,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          📄 Page {page}
        </span>
      )}
      {chunkIndex !== undefined && (
        <span style={{
          fontSize: 10, fontWeight: 500, color: '#64748b',
          background: '#f1f5f9', border: '1px solid #e2e8f0',
          padding: '2px 8px', borderRadius: 100,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          Chunk {chunkIndex + 1}{totalChunks ? ` of ~${totalChunks}` : ''}
        </span>
      )}
    </div>
  )
}

function RelevanceBar({ score }) {
  if (!score && score !== 0) return null
  const pct   = Math.min(100, Math.max(0, Math.round(score * 100)))
  const color = pct >= 70 ? '#1d9e75' : pct >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Relevance</span>
        <span style={{ fontSize: 10, fontWeight: 600, color }}>{pct}%</span>
      </div>
      <div style={{ height: 3, borderRadius: 100, background: '#e2e8f0', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: color, borderRadius: 100,
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  )
}

const normaliseScore = (raw) => {
  if (raw == null) return null
  return Math.min(1, Math.max(0, 1 / (1 + Math.exp(-raw * 0.4))))
}

export default function CitationPanel({ citations }) {
  const [open, setOpen] = useState(false)
  if (!citations || citations.length === 0) return null

  // Filter out low-relevance RAG citations (below 20%)
  // SQL and SharePoint citations always show regardless of score
  const visibleCitations = citations.filter(cite => {
    if (cite.type !== 'rag') return true
    const norm = normaliseScore(cite.rerank_score)
    if (norm == null) return true
    return norm >= 0.20
  })

  if (visibleCitations.length === 0) return null

  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none',
          color: 'var(--text-muted)', fontSize: 12,
          padding: '4px 0', cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 5,
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        {visibleCitations.length} source{visibleCitations.length > 1 ? 's' : ''}
        <span style={{ fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          marginTop: 8, background: 'white',
          border: '1px solid var(--border)',
          borderRadius: 10, overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}>
          {visibleCitations.map((cite, i) => {
            const cfg      = typeConfig[cite.type] || typeConfig.rag
            const normScore = normaliseScore(cite.rerank_score)

            return (
              <div
                key={i}
                style={{
                  padding: '12px 16px',
                  borderBottom: i < visibleCitations.length - 1
                    ? '1px solid var(--border-light)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600,
                    color: cfg.color, background: cfg.bg,
                    padding: '2px 7px', borderRadius: 4,
                    flexShrink: 0, marginTop: 1,
                  }}>
                    {cfg.icon} {cfg.label}
                  </span>

                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                      [{cite.index}]{' '}
                      {cite.url ? (
                        <a
                          href={cite.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--accent)', textDecoration: 'none' }}
                          onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
                          onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
                        >
                          {cite.label}
                        </a>
                      ) : (
                        cite.label
                      )}
                    </span>

                    {cite.embedded_source && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        └── embedded: {cite.embedded_source}
                      </div>
                    )}

                    {cite.type === 'rag' && (
                      <PageBadge
                        page={cite.page_number}
                        chunkIndex={cite.chunk_index}
                        totalChunks={cite.total_chunks}
                      />
                    )}

                    {cite.type === 'rag' && normScore != null && (
                      <RelevanceBar score={normScore} />
                    )}

                    {cite.detail && cite.type === 'sql' && (
                      <pre style={{
                        marginTop: 8,
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 11, color: 'var(--sql-color)',
                        background: '#f8fafc',
                        border: '1px solid var(--border)',
                        padding: '8px 12px', borderRadius: 6,
                        overflow: 'auto', whiteSpace: 'pre-wrap',
                      }}>
                        {cite.detail}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}