import { useState, useEffect } from 'react'
import { listDocuments, deleteDocument } from '../api/chat'
import { useToast } from '../context/ToastContext'
import client from '../api/client'

const METHOD_BADGE = {
  native: { label: 'Native', bg: 'rgba(29,158,117,0.08)',  color: '#1d9e75', border: 'rgba(29,158,117,0.2)' },
  hybrid: { label: 'Hybrid', bg: 'rgba(124,58,237,0.08)',  color: '#7c3aed', border: 'rgba(124,58,237,0.2)' },
  ocr:    { label: 'OCR',    bg: 'rgba(245,158,11,0.08)',  color: '#d97706', border: 'rgba(245,158,11,0.2)' },
}

const FILE_ICON = (name) => {
  const ext = name.split('.').pop().toLowerCase()
  if (ext === 'pdf')                return { icon: '📄', color: '#ef4444' }
  if (['docx','doc'].includes(ext)) return { icon: '📝', color: '#2563eb' }
  if (['pptx','ppt'].includes(ext)) return { icon: '📊', color: '#ea580c' }
  return { icon: '📁', color: 'var(--text-muted)' }
}

const formatDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const StatCard = ({ label, value, color }) => (
  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--shadow-sm)', flex: 1 }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 700, color: color || 'var(--text-primary)', letterSpacing: '-0.5px' }}>{value}</div>
  </div>
)

export default function DocumentsPage() {
  const toast = useToast()
  const [docs,      setDocs]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [syncing,   setSyncing]   = useState(false)
  const [search,    setSearch]    = useState('')
  const [deleting,  setDeleting]  = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [stats,     setStats]     = useState({ total_chunks: 0, total_docs: 0 })
  const [error,     setError]     = useState(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const res = await listDocuments()
      setDocs(res.data.documents || [])
      setStats({ total_chunks: res.data.total_chunks, total_docs: res.data.total_docs })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load documents')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      console.log('Calling API...')
      const res = await client.post('/documents/sync')
      console.log('API response:', res.data)
      toast.success('Sync started — this takes ~40 seconds')
      setTimeout(async () => { await load(); setSyncing(false) }, 45000)
    } catch (err) {
      console.error('Sync error:', err)
      toast.error('Sync failed: ' + (err.response?.data?.detail || err.message))
      setSyncing(false)
    }
  }

  const handleDelete = async (doc_id) => {
    setDeleting(doc_id)
    try {
      await deleteDocument(doc_id)
      setDocs(prev => prev.filter(d => d.doc_id !== doc_id))
      setStats(prev => ({ ...prev, total_docs: prev.total_docs - 1 }))
      toast.success('Document removed from knowledge base')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed')
    } finally { setDeleting(null); setConfirmId(null) }
  }

  const filtered = docs.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  )

  const lastIngested = docs.length > 0 ? formatDate(docs[0].ingested_at) : '—'

  return (
    <div style={{ flex: 1, background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>

      {/* Header */}
      <div style={{ padding: '14px 28px', borderBottom: '1px solid var(--border)', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 0 var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Knowledge Base</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{ background: syncing ? 'var(--bg-hover)' : 'white', border: '1px solid var(--border)', borderRadius: 6, color: syncing ? 'var(--text-muted)' : 'var(--accent)', cursor: syncing ? 'not-allowed' : 'pointer', fontSize: 12, padding: '5px 12px', fontFamily: 'inherit', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}
            onMouseEnter={e => { if (!syncing) e.currentTarget.style.borderColor = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            {syncing ? (
              <>
                <div style={{ width: 10, height: 10, border: '1.5px solid var(--text-muted)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Syncing...
              </>
            ) : '↻ Sync SharePoint'}
          </button>
          <button onClick={load} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '5px 10px', fontFamily: 'inherit', transition: 'border-color 0.15s' }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
            Refresh
          </button>
        </div>
      </div>

      <div style={{ padding: '32px', maxWidth: 900, width: '100%', margin: '0 auto' }}>

        {/* Page title */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Ingested Documents</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>All SharePoint documents indexed in ChromaDB for semantic search</div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
          <StatCard label="Total Documents" value={stats.total_docs}                    color="var(--accent)" />
          <StatCard label="Total Chunks"    value={stats.total_chunks.toLocaleString()} color="var(--rag-color)" />
          <StatCard label="Last Ingested"   value={lastIngested} />
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents by name..."
            style={{ width: '100%', padding: '10px 14px 10px 36px', background: 'white', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              {search ? 'No documents match your search' : 'No documents ingested yet'}
            </div>
            <div style={{ fontSize: 13 }}>
              {search ? 'Try a different search term' : 'Connect SharePoint and click "Sync SharePoint" to index documents'}
            </div>
          </div>
        )}

        {/* Document list */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {search && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                {filtered.length} of {docs.length} documents
              </div>
            )}
            {filtered.map(doc => {
              const { icon, color } = FILE_ICON(doc.name)
              const badge      = METHOD_BADGE[doc.method] || METHOD_BADGE.native
              const isDeleting  = deleting  === doc.doc_id
              const isConfirming = confirmId === doc.doc_id

              return (
                <div
                  key={doc.doc_id}
                  style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'flex-start', gap: 14, transition: 'box-shadow 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
                >
                  {/* File icon */}
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}12`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      {doc.web_url ? (
                        <a href={doc.web_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
                          {doc.name}
                        </a>
                      ) : (
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{doc.name}</span>
                      )}
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 100, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, flexShrink: 0 }}>
                        {badge.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        📄 {doc.page_count} page{doc.page_count !== 1 ? 's' : ''}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        🔷 {doc.chunks} chunk{doc.chunks !== 1 ? 's' : ''}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        🕐 {formatDate(doc.ingested_at)}
                      </span>
                    </div>
                  </div>

                  {/* Delete */}
                  <div style={{ flexShrink: 0 }}>
                    {isConfirming ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Remove?</span>
                        <button onClick={() => handleDelete(doc.doc_id)} disabled={isDeleting} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#ef4444', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {isDeleting ? '...' : 'Yes'}
                        </button>
                        <button onClick={() => setConfirmId(null)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'white', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(doc.doc_id)}
                        title="Remove from ChromaDB"
                        style={{ background: 'none', border: '1px solid transparent', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer', padding: '6px 8px', transition: 'all 0.15s', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#fecaca'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.04)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/>
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}