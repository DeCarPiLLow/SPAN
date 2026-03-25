import { useEffect, useState } from 'react'
import { getListeningClock } from '../../api/personal'
import { PageHeader, LoadingSpinner, Card } from '../../components/ui'
import SyncPrompt from '../../components/ui/SyncPrompt'
import { hourLabel } from '../../utils/formatters'

export default function ListeningClock() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    getListeningClock()
      .then(r => { setData(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) return <LoadingSpinner message="Analyzing your listening patterns..." />

  const total    = data ? data.reduce((s, d) => s + d.count, 0) : 0
  const maxCount = data ? Math.max(...data.map(d => d.count), 1) : 1

  const getColor = (count) => {
    if (count === 0) return 'bg-white/5'
    const i = count / maxCount
    if (i < 0.25) return 'bg-spotify-green/20'
    if (i < 0.5)  return 'bg-spotify-green/40'
    if (i < 0.75) return 'bg-spotify-green/70'
    return 'bg-spotify-green'
  }

  const peakHour = data ? data.reduce((a, b) => a.count > b.count ? a : b, data[0]) : null

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader badge="Personal" title="Listening Clock"
        subtitle="When do you listen most? A 24-hour heatmap of your listening patterns." />

      {total === 0 ? (
        <SyncPrompt onDone={load} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card className="border-spotify-green/20 bg-spotify-green/5">
              <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Peak Hour</p>
              <p className="font-display text-3xl font-bold text-spotify-green mt-1">{hourLabel(peakHour.hour)}</p>
              <p className="text-white/40 text-xs mt-1">{peakHour.count} plays</p>
            </Card>
            <Card>
              <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Night Owl %</p>
              <p className="font-display text-3xl font-bold text-white mt-1">
                {Math.round(data.filter(d => d.hour >= 22 || d.hour <= 4).reduce((s, d) => s + d.count, 0) / Math.max(total, 1) * 100)}%
              </p>
              <p className="text-white/40 text-xs mt-1">10pm – 4am</p>
            </Card>
            <Card>
              <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Morning %</p>
              <p className="font-display text-3xl font-bold text-white mt-1">
                {Math.round(data.filter(d => d.hour >= 6 && d.hour <= 10).reduce((s, d) => s + d.count, 0) / Math.max(total, 1) * 100)}%
              </p>
              <p className="text-white/40 text-xs mt-1">6am – 10am</p>
            </Card>
          </div>

          <Card>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-6">24-Hour Activity</p>
            <div className="flex items-end gap-0.5 h-32">
              {data.map(d => (
                <div key={d.hour} className="flex-1 group" title={`${hourLabel(d.hour)}: ${d.count} plays`}>
                  <div className={`w-full rounded-t transition-all duration-500 group-hover:opacity-80 ${getColor(d.count)}`}
                    style={{ height: `${Math.max(d.count / maxCount * 100, d.count > 0 ? 4 : 1)}%` }} />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-white/20 text-[10px] font-mono mt-2">
              {[0, 3, 6, 9, 12, 15, 18, 21].map(h => <span key={h}>{hourLabel(h)}</span>)}
            </div>
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
              <span className="text-white/30 text-xs font-mono">Less</span>
              {['bg-white/5','bg-spotify-green/20','bg-spotify-green/40','bg-spotify-green/70','bg-spotify-green'].map(c => (
                <div key={c} className={`w-4 h-4 rounded-sm ${c}`} />
              ))}
              <span className="text-white/30 text-xs font-mono">More</span>
            </div>
          </Card>

          <Card>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-4">Hourly breakdown</p>
            <div className="space-y-1.5">
              {data.map(d => (
                <div key={d.hour} className="flex items-center gap-3">
                  <span className="text-white/30 text-xs font-mono w-10 text-right">{hourLabel(d.hour)}</span>
                  <div className="flex-1 h-4 bg-white/5 rounded overflow-hidden">
                    <div className="h-full bg-spotify-green/60 rounded transition-all duration-500"
                      style={{ width: `${(d.count / maxCount) * 100}%` }} />
                  </div>
                  <span className="text-white/30 text-xs font-mono w-8">{d.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
