import clsx from 'clsx'

export function Card({ children, className }) {
  return (
    <div className={clsx('bg-spotify-card rounded-xl border border-white/5 p-6', className)}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, accent = false, className }) {
  return (
    <div className={clsx(
      'bg-spotify-card rounded-xl border border-white/5 p-5 flex flex-col gap-1',
      accent && 'border-spotify-green/20 bg-spotify-green/5',
      className
    )}>
      <p className="text-white/40 text-xs font-mono uppercase tracking-wider">{label}</p>
      <p className={clsx('text-3xl font-display font-bold', accent ? 'text-spotify-green' : 'text-white')}>{value}</p>
      {sub && <p className="text-white/40 text-xs">{sub}</p>}
    </div>
  )
}

export function PageHeader({ title, subtitle, badge }) {
  return (
    <div className="mb-8">
      {badge && (
        <span className="inline-block bg-spotify-green/10 text-spotify-green text-xs font-mono uppercase tracking-widest px-3 py-1 rounded-full mb-3">
          {badge}
        </span>
      )}
      <h1 className="font-display text-3xl font-bold text-white">{title}</h1>
      {subtitle && <p className="text-white/50 mt-2 text-sm leading-relaxed">{subtitle}</p>}
    </div>
  )
}

export function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-10 h-10 border-2 border-spotify-green/20 border-t-spotify-green rounded-full animate-spin" />
      <p className="text-white/30 text-sm font-mono">{message}</p>
    </div>
  )
}

export function EmptyState({ icon = '◎', title, message, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <span className="text-5xl opacity-20">{icon}</span>
      <div>
        <p className="text-white/60 font-medium">{title}</p>
        {message && <p className="text-white/30 text-sm mt-1">{message}</p>}
      </div>
      {action && (
        <button onClick={onAction}
          className="mt-2 px-4 py-2 bg-spotify-green/10 hover:bg-spotify-green/20 text-spotify-green text-sm rounded-lg transition-all font-mono">
          {action}
        </button>
      )}
    </div>
  )
}

export function TimeRangeSelector({ value, onChange }) {
  const ranges = [
    { value: 'short_term',  label: '4 Weeks' },
    { value: 'medium_term', label: '6 Months' },
    { value: 'long_term',   label: 'All Time' },
  ]
  return (
    <div className="flex gap-1 bg-white/5 rounded-lg p-1">
      {ranges.map(r => (
        <button key={r.value} onClick={() => onChange(r.value)}
          className={clsx(
            'px-3 py-1.5 rounded-md text-xs font-mono transition-all',
            value === r.value ? 'bg-spotify-green text-black font-bold' : 'text-white/50 hover:text-white'
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

export function SectionTitle({ children }) {
  return <h2 className="font-display text-lg font-semibold text-white mb-4">{children}</h2>
}

export function ProgressBar({ value, max = 1, color = '#1DB954', label, pct }) {
  const width = Math.min((value / max) * 100, 100)
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex justify-between items-center">
          <span className="text-white/60 text-xs capitalize">{label}</span>
          <span className="text-white/40 text-xs font-mono">{pct || `${Math.round(width)}%`}</span>
        </div>
      )}
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
    </div>
  )
}

export { default as SyncPrompt } from './SyncPrompt'
