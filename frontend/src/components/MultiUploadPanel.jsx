import { useState, useRef, useCallback } from 'react'
import { previewFile, ingestFile } from '../api/chat'

const STATUS = { pending: 'pending', loading: 'loading', done: 'done', error: 'error' }

const toTableName = (filename) => {
  return filename
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50) || 'upload'
}

const FileStatusIcon = ({ status }) => {
  if (status === STATUS.pending) return <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>○</span>
  if (status === STATUS.loading) return (
    <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
  )
  if (status === STATUS.done) return <span style={{ fontSize: 16, color: '#1d9e75' }}>✓</span>
  if (status === STATUS.error) return <span style={{ fontSize: 16, color: '#ef4444' }}>✗</span>
  return null
}

export default function MultiUploadPanel({ onUploaded }) {
  const [files,    setFiles]    = useState([])
  const [running,  setRunning]  = useState(false)
  const [done,     setDone]     = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const addFiles = useCallback((newFiles) => {
    const supported = Array.from(newFiles).filter(f => {
      const ext = f.name.split('.').pop().toLowerCase()
      return ['csv', 'xlsx', 'xls'].includes(ext)
    })
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.file.name))
      const toAdd = supported
        .filter(f => !existing.has(f.name))
        .map(f => ({
          file:       f,
          tableName:  toTableName(f.name),
          status:     STATUS.pending,
          rows:       null,
          error:      null,
        }))
      return [...prev, ...toAdd]
    })
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const handleRemove = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleLoadAll = async () => {
    if (running || files.length === 0) return
    setRunning(true)

    for (let i = 0; i < files.length; i++) {
      const item = files[i]
      if (item.status === STATUS.done) continue

      // Set to loading
      setFiles(prev => prev.map((f, idx) =>
        idx === i ? { ...f, status: STATUS.loading, error: null } : f
      ))

      try {
        const res = await ingestFile(item.file, item.tableName)
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: STATUS.done, rows: res.data.rows } : f
        ))
      } catch (err) {
        const msg = err.response?.data?.detail || err.message || 'Failed'
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: STATUS.error, error: msg } : f
        ))
      }
    }

    setRunning(false)
    setDone(true)
    if (onUploaded) onUploaded()
  }

  const reset = () => {
    setFiles([])
    setRunning(false)
    setDone(false)
  }

  const allDone    = files.length > 0 && files.every(f => f.status === STATUS.done)
  const hasErrors  = files.some(f => f.status === STATUS.error)
  const hasPending = files.some(f => f.status === STATUS.pending)
  const successCount = files.filter(f => f.status === STATUS.done).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Drop zone */}
      {!done && (
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}
          style={{
            background: dragging ? '#eff6ff' : 'white',
            border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 12, padding: '28px 24px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 10,
            cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: dragging ? '0 0 0 4px rgba(37,99,235,0.08)' : 'none',
          }}
          onMouseEnter={e => { if (!dragging) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = '#fafbff' } }}
          onMouseLeave={e => { if (!dragging) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'white' } }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            multiple
            style={{ display: 'none' }}
            onChange={e => addFiles(e.target.files)}
          />
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📂</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            Drop multiple files here
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            or click to browse · CSV, XLSX, XLS · multiple files supported
          </div>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {files.length} file{files.length > 1 ? 's' : ''} selected
            </span>
            {!running && !allDone && (
              <button onClick={reset} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                Clear all
              </button>
            )}
          </div>

          {files.map((item, i) => (
            <div key={item.file.name} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px',
              borderBottom: i < files.length - 1 ? '1px solid var(--border-light)' : 'none',
              background: item.status === STATUS.done ? 'rgba(29,158,117,0.03)' : item.status === STATUS.error ? 'rgba(239,68,68,0.03)' : 'white',
            }}>
              <FileStatusIcon status={item.status} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.file.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--sql-color)' }}>
                    → {item.tableName}
                  </span>
                  {item.status === STATUS.done && item.rows != null && (
                    <span style={{ color: '#1d9e75' }}>· {item.rows.toLocaleString()} rows loaded</span>
                  )}
                  {item.status === STATUS.error && (
                    <span style={{ color: '#ef4444' }}>· {item.error}</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {(item.file.size / 1024).toFixed(0)} KB
                </span>
                {!running && item.status !== STATUS.done && (
                  <button onClick={() => handleRemove(i)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: '0 2px', lineHeight: 1 }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >×</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary after done */}
      {done && (
        <div style={{
          padding: '12px 16px', borderRadius: 10,
          background: hasErrors ? 'rgba(239,68,68,0.06)' : 'rgba(29,158,117,0.06)',
          border: `1px solid ${hasErrors ? 'rgba(239,68,68,0.2)' : 'rgba(29,158,117,0.2)'}`,
          fontSize: 13,
          color: hasErrors ? '#ef4444' : '#1d9e75',
        }}>
          {hasErrors
            ? `${successCount} of ${files.length} files loaded successfully. ${files.length - successCount} failed.`
            : `All ${successCount} file${successCount > 1 ? 's' : ''} loaded successfully! You can now query them in the chat.`
          }
        </div>
      )}

      {/* Suggested queries after done */}
      {allDone && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', fontSize: 12 }}>
          <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>💡 Try these queries:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {files.filter(f => f.status === STATUS.done).map(f => (
              <span key={f.tableName} style={{ color: 'var(--text-secondary)' }}>
                "Show me all data from <strong>{f.tableName}</strong>"
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {files.length > 0 && !done && (
        <div style={{ display: 'flex', gap: 10 }}>
          {!running && hasPending && (
            <button onClick={() => inputRef.current?.click()} style={{ padding: '10px 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'white', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Add more
            </button>
          )}
          <button
            onClick={handleLoadAll}
            disabled={running || !hasPending}
            style={{
              flex: 1, padding: '11px',
              border: 'none', borderRadius: 8,
              background: running || !hasPending ? 'var(--bg-hover)' : 'linear-gradient(135deg, #2563eb, #7c3aed)',
              color: running || !hasPending ? 'var(--text-muted)' : 'white',
              fontSize: 13, fontWeight: 600,
              cursor: running ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {running ? (
              <>
                <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Loading files...
              </>
            ) : (
              `Load ${files.filter(f => f.status === STATUS.pending).length} file${files.filter(f => f.status === STATUS.pending).length > 1 ? 's' : ''} into MySQL →`
            )}
          </button>
        </div>
      )}

      {done && (
        <button onClick={reset} style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: 8, background: 'white', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          Upload more files
        </button>
      )}
    </div>
  )
}