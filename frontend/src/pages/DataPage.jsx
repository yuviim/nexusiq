import { useState } from 'react'
import { FileUp, Files } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import UploadPanel from '../components/UploadPanel'
import MultiUploadPanel from '../components/MultiUploadPanel'

export default function DataPage() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('single')

  return (
    <div style={{ flex: 1, background: '#f4f5f7', overflow: 'auto' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 28px' }}>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111', letterSpacing: '-0.5px', marginBottom: 6 }}>Data Management</div>
          <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Upload CSV or Excel files to make them instantly queryable in plain English.</div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 4, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
          {[
            { id: 'single', label: 'Single File',  Icon: FileUp  },
            { id: 'bulk',   label: 'Bulk Upload',  Icon: Files   },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: activeTab === tab.id ? '#2563eb' : 'transparent', color: activeTab === tab.id ? 'white' : '#6b7280', transition: 'all 0.15s' }}>
              <tab.Icon size={14} strokeWidth={2} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Info */}
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.15)', fontSize: 13, color: '#374151', marginBottom: 24, lineHeight: 1.6, fontWeight: 500 }}>
          💡 {activeTab === 'single'
            ? 'Preview your data before loading. Each file becomes a queryable SQL table. Ask questions immediately after loading.'
            : 'Drop multiple files at once. Each file gets its own table named from the filename. Files are loaded sequentially with live status.'}
        </div>

        {activeTab === 'single' ? (
          <UploadPanel onUploaded={() => toast.success('Data loaded! Query it in the Chat tab.')} />
        ) : (
          <MultiUploadPanel onUploaded={() => toast.success('Files loaded! Query them in the Chat tab.')} />
        )}
      </div>
    </div>
  )
}