import { useEffect, useState } from 'react'
import { getDiscovery } from '../../api/personal'
import { PageHeader, LoadingSpinner, Card, StatCard } from '../../components/ui'
import SyncPrompt from '../../components/ui/SyncPrompt'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

export default function DiscoveryRatio() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const load = () => {
    setLoading(true)
    getDiscovery().then(r => { setData(r.data); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  if (loading) return <LoadingSpinner message="Calculating discovery ratio..." />
  if (!data || data.total_plays === 0) return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader badge="Personal" title="Discovery Ratio" subtitle="New finds vs. familiar plays in the last 30 days." />
      <SyncPrompt onDone={load} />
    </div>
  )

  const pieData = [
    { name: 'New Finds', value: data.new_finds },
    { name: 'Repeat Tracks', value: data.repeat_tracks },
  ]
  const label = data.ratio > 0.5 ? 'Explorer' : data.ratio > 0.25 ? 'Balanced' : 'Comfort Listener'
  const labelColor = data.ratio > 0.5 ? 'text-spotify-green' : data.ratio > 0.25 ? 'text-yellow-400' : 'text-blue-400'

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader badge="Personal" title="Discovery Ratio"
        subtitle={`Tracks heard for the first time vs. familiar plays in the last ${data.window_days} days.`} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Discovery Rate" value={`${(data.ratio * 100).toFixed(1)}%`} accent />
        <StatCard label="New Finds"      value={data.new_finds}     sub="first listens / 30d" />
        <StatCard label="Repeat Tracks"  value={data.repeat_tracks} sub="familiar plays" />
        <StatCard label="Total Plays"    value={data.total_plays}   sub="in history" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="flex flex-col items-center justify-center">
          <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-4 self-start">Breakdown</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                <Cell fill="#1DB954" /><Cell fill="#333" />
              </Pie>
              <Tooltip contentStyle={{ background: '#181818', border: '1px solid #333', borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card className="flex flex-col justify-center">
          <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-4">Your Profile</p>
          <div className={`text-4xl font-display font-bold ${labelColor} mb-2`}>{label}</div>
          <p className="text-white/50 text-sm leading-relaxed">
            {data.ratio > 0.5 ? "You're actively discovering new music. More than half your recent plays are first-time listens."
              : data.ratio > 0.25 ? "You balance familiar favorites with new discoveries—a healthy mix."
              : "You gravitate toward music you know and love. Comfort is your groove."}
          </p>
        </Card>
      </div>
    </div>
  )
}
