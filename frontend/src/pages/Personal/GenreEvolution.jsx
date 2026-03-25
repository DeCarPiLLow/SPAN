import { useEffect, useState } from 'react'
import { getGenreEvolution } from '../../api/personal'
import { PageHeader, LoadingSpinner, EmptyState, Card } from '../../components/ui'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#1DB954','#1ed760','#17a348','#0f7a34','#0a5224','#e8f5e9','#a5d6a7','#66bb6a','#43a047','#2e7d32']

export default function GenreEvolution() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [rangeKey, setRangeKey] = useState('daily')

  const subtitle = rangeKey === 'daily'
    ? 'How your genre taste has shifted day by day (last 7 days).'
    : rangeKey === 'weekly'
      ? 'How your genre taste has shifted week by week (last 6 weeks).'
      : rangeKey === 'monthly'
        ? 'How your genre taste has shifted month by month (last 6 months).'
        : 'How your genre taste has shifted quarter by quarter (last 4 quarters).'

  const load = () => {
    setLoading(true)
    getGenreEvolution(rangeKey)
      .then(r => { setData(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleApply = () => load()

  if (loading) return <LoadingSpinner message="Loading genre history..." />
  if (!data.length) return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader badge="Personal" title="Genre Evolution" subtitle={subtitle} />
      <EmptyState
        icon="▦"
        title="No genre snapshots in this range"
        message="Trigger a sync and come back in a bit (snapshots are generated asynchronously)."
      />
    </div>
  )

  // Build chart data — normalise all genres across all months
  const allGenres = [...new Set(data.flatMap(s => Object.keys(s.genre_distribution || {})))]
    .sort((a,b) => {
      const sumA = data.reduce((s,d) => s + (d.genre_distribution?.[a] || 0), 0)
      const sumB = data.reduce((s,d) => s + (d.genre_distribution?.[b] || 0), 0)
      return sumB - sumA
    }).slice(0, 8)

  const chartData = data.map(s => ({
    month: s.month,
    ...Object.fromEntries(allGenres.map(g => [g, Math.round((s.genre_distribution?.[g] || 0) * 100)]))
  }))

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader badge="Personal" title="Genre Evolution" subtitle={subtitle} />

      <Card className="flex items-center gap-4 py-4">
        <div className="min-w-[180px]">
          <p className="text-white/40 text-xs font-mono uppercase tracking-widest mb-2">Range</p>
          <select
            value={rangeKey}
            onChange={(e) => setRangeKey(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
          >
            <option value="daily">Daily (last 7 days)</option>
            <option value="weekly">Weekly (last 6 weeks)</option>
            <option value="monthly">Monthly (last 6 months)</option>
            <option value="quarterly">Quarterly (last 4 quarters)</option>
          </select>
        </div>
        <button
          onClick={handleApply}
          className="ml-auto bg-spotify-green/10 hover:bg-spotify-green/20 text-spotify-green px-3 py-2 rounded-lg text-sm transition-all"
        >
          Apply
        </button>
      </Card>

      <Card>
        <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-6">Genre Distribution Over Time</p>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <XAxis dataKey="month" tick={{ fill: '#ffffff40', fontSize: 11 }} />
            <YAxis tick={{ fill: '#ffffff40', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#181818', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#fff', marginBottom: 4 }} formatter={(v) => `${v}%`} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#ffffff60' }} />
            {allGenres.map((g, i) => (
              <Area key={g} type="monotone" dataKey={g} stackId="1"
                stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]}
                fillOpacity={0.6} strokeWidth={1} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}
