import { Shield, ShieldCheck } from 'lucide-react'

export default function RoleBadge({ role }) {
  if (!role) return null

  const isAdmin = role === 'admin'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      background: isAdmin ? '#ede9fe' : '#f0fdf4',
      border: `1px solid ${isAdmin ? '#c4b5fd' : '#bbf7d0'}`,
    }}>
      {isAdmin
        ? <ShieldCheck size={12} color="#6d28d9" strokeWidth={2} />
        : <Shield size={12} color="#15803d" strokeWidth={2} />
      }
      <span style={{
        fontSize: 11, fontWeight: 700,
        color: isAdmin ? '#6d28d9' : '#15803d',
        textTransform: 'capitalize',
      }}>
        {role}
      </span>
    </div>
  )
}