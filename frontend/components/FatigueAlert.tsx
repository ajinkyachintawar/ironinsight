interface Props {
  struggling: boolean
  redline: boolean
}

export default function FatigueAlert({ struggling, redline }: Props) {
  if (redline) return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '10px 16px', borderRadius: 8,
      background: 'var(--red-dim)', borderLeft: '3px solid var(--red)',
    }}>
      <div>
        <p style={{ color: 'var(--red)', fontWeight: 600, fontSize: 13, margin: 0 }}>Redline Detected</p>
        <p style={{ color: 'var(--text-2)', fontSize: 12, margin: '2px 0 0' }}>
          HR sustained above 95% max — reduce intensity now
        </p>
      </div>
    </div>
  )

  if (struggling) return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '10px 16px', borderRadius: 8,
      background: 'var(--amber-dim)', borderLeft: '3px solid var(--amber)',
    }}>
      <div>
        <p style={{ color: 'var(--amber)', fontWeight: 600, fontSize: 13, margin: 0 }}>Struggling</p>
        <p style={{ color: 'var(--text-2)', fontSize: 12, margin: '2px 0 0' }}>
          High HR with power dropping — consider a rest interval
        </p>
      </div>
    </div>
  )

  return null
}
