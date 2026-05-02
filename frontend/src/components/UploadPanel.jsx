import { useState, useRef, useCallback } from 'react'
import { previewFile, ingestFile, listTables } from '../api/chat'

const STATUS = { idle: 'idle', previewing: 'previewing', preview: 'preview', uploading: 'uploading', done: 'done', error: 'error' }

export default function UploadPanel({ onUploaded }) {
  const [status, setStatus]       = useState(STATUS.idle)
  const [file, setFile]           = useState(null)
  const [preview, setPreview]     = useState(null)
  const [tableName, setTableName] = useState('')
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState('')
  const [dragging, setDragging]   = useState(false)
  const inputRef = useRef(null)

  const handleFile = useCallback(async (f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setError('Only CSV and Excel files are supported')
      setStatus(STATUS.error)
      return
    }
    setFile(f)
    setStatus(STATUS.previewing)
    setError('')
    try {
      const res = await previewFile(f)
      setPreview(res.data)
      setTableName(res.data.table_name)
      setStatus(STATUS.preview)
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
      setStatus(STATUS.error)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleIngest = async () => {
    if (!file || !tableName.trim()) return
    setStatus(STATUS.uploading)
    try {
      const res = await ingestFile(file, tableName.trim())
      setResult(res.data)
      setStatus(STATUS.done)
      if (onUploaded) onUploaded(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
      setStatus(STATUS.error)
    }
  }

  const reset = () => {
    setStatus(STATUS.idle)
    setFile(null)
    setPreview(null)
    setTableName('')
    setResult(null)
    setError('')
  }

  // ── Done state ────────────────────────────────────────────────────────────
  if (status === STATUS.done && result) {
    return (
      <div style={{
        background: 'white', border: '1px solid var(--border)',
        borderRadius: 12, padding: 24,
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: '#f0fdf4', border: '1px solid #86efac',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>✓</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              Upload successful
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {result.message}
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16,
          display: 'flex', gap: 20,
        }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Table</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sql-color)', fontFamily: 'JetBrains Mono, monospace' }}>
              {result.table_name}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rows</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {result.rows.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Columns</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {result.columns.length}
            </div>
          </div>
        </div>

        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>
            💡 Your data is ready to query
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
            Available columns: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)' }}>{result.columns.join(', ')}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
            `Show me all data from ${result.table_name}`,
            `How many rows are in ${result.table_name}?`,
            `What is the total of each numeric column in ${result.table_name}?`,
            ].map((q, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', border: '1px solid #bfdbfe', borderRadius: 6, padding: '6px 10px' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{q}</span>
                <button
                onClick={() => navigator.clipboard.writeText(q)}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                >
                Copy →
                </button>
            </div>
            ))}
        </div>
        </div>

        <button onClick={reset} style={{
          background: 'white', border: '1px solid var(--border)',
          borderRadius: 8, color: 'var(--text-secondary)',
          fontSize: 13, fontWeight: 500, padding: '8px 16px',
          cursor: 'pointer', fontFamily: 'inherit',
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          Upload another file
        </button>
      </div>
    )
  }

  // ── Preview state ─────────────────────────────────────────────────────────
  if (status === STATUS.preview && preview) {
    return (
      <div style={{
        background: 'white', border: '1px solid var(--border)',
        borderRadius: 12, padding: 24,
        boxShadow: 'var(--shadow-md)',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* File info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: '#eff6ff', border: '1px solid #bfdbfe',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>
            {file.name.endsWith('.csv') ? '📄' : '📊'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {file.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {preview.total_rows.toLocaleString()} rows · {preview.columns.length} columns
            </div>
          </div>
          <button onClick={reset} style={{
            background: 'none', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer',
            fontSize: 18, padding: '0 4px',
          }}>×</button>
        </div>

        {/* Table name input */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6 }}>
            Table Name
          </label>
          <input
            value={tableName}
            onChange={e => setTableName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
            style={{
              width: '100%', background: 'var(--bg-secondary)',
              border: '1px solid var(--border)', borderRadius: 8,
              color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace',
              fontSize: 13, padding: '8px 12px', outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            This will be the SQL table name. Only lowercase letters, numbers, underscores.
          </div>
        </div>

        {/* Data preview */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
            Preview (first 5 rows)
          </div>
          <div style={{ overflow: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                  {preview.columns.map(col => (
                    <th key={col} style={{
                      padding: '8px 12px', textAlign: 'left',
                      fontWeight: 600, color: 'var(--text-secondary)',
                      fontSize: 11, textTransform: 'uppercase',
                      letterSpacing: '0.5px', whiteSpace: 'nowrap',
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((row, i) => (
                  <tr key={i} style={{ borderBottom: i < preview.preview.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                    {preview.columns.map(col => (
                      <td key={col} style={{
                        padding: '8px 12px', color: 'var(--text-primary)',
                        whiteSpace: 'nowrap', maxWidth: 200,
                        overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={reset} style={{
            background: 'white', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text-secondary)',
            fontSize: 13, fontWeight: 500, padding: '10px 16px',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--danger)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            Cancel
          </button>
          <button
            onClick={handleIngest}
            disabled={!tableName.trim()}
            style={{
              flex: 1,
              background: tableName.trim() ? 'var(--accent)' : 'var(--bg-hover)',
              border: 'none', borderRadius: 8,
              color: tableName.trim() ? 'white' : 'var(--text-muted)',
              fontSize: 13, fontWeight: 600,
              padding: '10px 16px',
              cursor: tableName.trim() ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', transition: 'all 0.15s',
              boxShadow: tableName.trim() ? '0 2px 8px rgba(37,99,235,0.25)' : 'none',
            }}
            onMouseEnter={e => tableName.trim() && (e.currentTarget.style.background = 'var(--accent-hover)')}
            onMouseLeave={e => tableName.trim() && (e.currentTarget.style.background = 'var(--accent)')}
          >
            Load {preview.total_rows.toLocaleString()} rows into MySQL →
          </button>
        </div>
      </div>
    )
  }

  // ── Uploading state ───────────────────────────────────────────────────────
  if (status === STATUS.uploading) {
    return (
      <div style={{
        background: 'white', border: '1px solid var(--border)',
        borderRadius: 12, padding: 32,
        boxShadow: 'var(--shadow-md)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 16,
      }}>
        <div style={{
          width: 40, height: 40,
          border: '3px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
          Loading data into MySQL...
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          This may take a moment for large files
        </div>
      </div>
    )
  }

  // ── Idle / Error state ────────────────────────────────────────────────────
  return (
    <div
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onClick={() => inputRef.current?.click()}
      style={{
        background: dragging ? '#eff6ff' : 'white',
        border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 12, padding: '40px 24px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 12,
        cursor: 'pointer', transition: 'all 0.2s',
        boxShadow: dragging ? '0 0 0 4px rgba(37,99,235,0.08)' : 'none',
      }}
      onMouseEnter={e => {
        if (status !== STATUS.previewing) {
          e.currentTarget.style.borderColor = 'var(--accent)'
          e.currentTarget.style.background  = '#fafbff'
        }
      }}
      onMouseLeave={e => {
        if (!dragging) {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.background  = 'white'
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])}
      />

      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: 'var(--accent-dim)',
        border: '1px solid rgba(37,99,235,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24,
      }}>
        📂
      </div>

      {status === STATUS.previewing ? (
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Reading file...
        </div>
      ) : (
        <>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            Drop your CSV or Excel file here
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            or click to browse · .csv, .xlsx, .xls supported
          </div>
        </>
      )}

      {status === STATUS.error && (
        <div style={{
          fontSize: 12, color: 'var(--danger)',
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 6, padding: '6px 12px', marginTop: 4,
        }}>
          {error}
        </div>
      )}
    </div>
  )
}