const shimmer = {
  background: 'linear-gradient(90deg, #f0f2f5 25%, #e8eaed 50%, #f0f2f5 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.4s ease infinite',
}

export function SkeletonLine({ width = '100%', height = 14, style = {} }) {
  return (
    <div style={{
      width, height,
      borderRadius: 6,
      ...shimmer,
      ...style,
    }} />
  )
}

export function SkeletonMessage() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      marginBottom: 24, animation: 'fadeIn 0.25s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, ...shimmer }} />
        <SkeletonLine width={80} height={12} />
        <SkeletonLine width={60} height={12} />
      </div>
      <div style={{
        background: '#f8f9fb',
        border: '1px solid var(--border)',
        borderRadius: '4px 16px 16px 16px',
        padding: '16px 20px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <SkeletonLine width="90%" />
        <SkeletonLine width="75%" />
        <SkeletonLine width="82%" />
        <SkeletonLine width="60%" />
      </div>
    </div>
  )
}

export function SkeletonTable() {
  return (
    <div style={{
      background: '#f8f9fb',
      border: '1px solid var(--border)',
      borderRadius: '4px 16px 16px 16px',
      padding: '16px 20px',
    }}>
      <SkeletonLine width="40%" height={18} style={{ marginBottom: 16 }} />
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ background: '#f0f2f5', padding: '10px 16px', display: 'flex', gap: 16 }}>
          {[100, 140, 100, 120].map((w, i) => (
            <SkeletonLine key={i} width={w} height={10} />
          ))}
        </div>
        {[1,2,3].map(i => (
          <div key={i} style={{ padding: '10px 16px', display: 'flex', gap: 16, borderTop: '1px solid var(--border)' }}>
            {[100, 140, 100, 120].map((w, j) => (
              <SkeletonLine key={j} width={w} height={10} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}