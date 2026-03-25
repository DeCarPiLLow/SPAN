import { useEffect, useState } from 'react'
import { getMoodDelta } from '../../api/comparison'
import { PageHeader, LoadingSpinner, EmptyState, Card } from '../../components/ui'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Legend } from 'recharts'

export default function MoodDelta() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMoodDelta().then(r => { setData(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner message="Comparing moods..." />

  const hasData = data?.user && Object.values(data.user).some(v => v > 0)

  const dims = ['energy', 'valence', 'danceability', 'acousticness', 'liveness']
  const radarData = hasData ? dims.map(k => ({
    axis: k.charAt(0).toUpperCase() + k.slice(1),
    you:    Number((data.user[k] || 0).toFixed(3)),
    global: Number((data.global[k] || 0).toFixed(3)),
  })) : []

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader badge="Compare" title="Mood Delta" subtitle="Your emotional audio profile vs. the world's current mood." />
      {!hasData ? (
        <EmptyState icon="△" title="Not enough data" message="Sync your data and ensure global snapshots exist." />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-4">Overlay Comparison</p>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#ffffff08" />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: '#ffffff50', fontSize: 11 }} />
                  <Radar name="You" dataKey="you" stroke="#1DB954" fill="#1DB954" fillOpacity={0.2} strokeWidth={2} />
                  <Radar name="Global" dataKey="global" stroke="#ffffff40" fill="#ffffff" fillOpacity={0.05} strokeWidth={1} strokeDasharray="4 2" />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#ffffff60' }} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-4">Delta Scores</p>
              <div className="space-y-4">
                {dims.map(k => {
                  const d = data.delta?.[k] || 0
                  return (
                    <div key={k} className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-white/60 text-sm capitalize">{k}</span>
                        <span className={`text-sm font-mono font-bold ${d > 0.05 ? 'text-spotify-green' : d < -0.05 ? 'text-red-400' : 'text-white/40'}`}>
                          {d > 0 ? '+' : ''}{(d * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-white/30 text-xs">
                        {d > 0.1 ? `Higher than global average` : d < -0.1 ? `Lower than global average` : 'Similar to global average'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
