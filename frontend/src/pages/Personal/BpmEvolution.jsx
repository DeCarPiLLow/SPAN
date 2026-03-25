import { useEffect, useState } from 'react'
import { getBpmEvolution } from '../../api/personal'
import { PageHeader, LoadingSpinner, Card } from '../../components/ui'
import SyncPrompt from '../../components/ui/SyncPrompt'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function BpmEvolution() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const load = () => {
    setLoading(true)
    getBpmEvolution().then(r => { setData(r.data); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])
  if (loading) return <LoadingSpinner message="Calculating BPM timeline..." />
  const avg = data.length ? Math.round(data.reduce((s,d) => s + d.avg_bpm, 0) / data.length) : 0
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader badge="Personal" title="BPM Evolution" subtitle="Average tempo of your listening over time." />
      {!data.length ? <SyncPrompt onDone={load} /> : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-spotify-green/20 bg-spotify-green/5">
              <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Average BPM</p>
              <p className="font-display text-3xl font-bold text-spotify-green mt-1">{avg}</p>
            </Card>
            <Card>
              <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Pace</p>
              <p className="font-display text-2xl font-bold text-white mt-1">{avg > 130 ? 'Fast' : avg > 100 ? 'Moderate' : 'Slow'}</p>
            </Card>
            <Card>
              <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Months</p>
              <p className="font-display text-3xl font-bold text-white mt-1">{data.length}</p>
            </Card>
          </div>
          <Card>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-6">BPM Over Time</p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="#ffffff08" />
                <XAxis dataKey="month" tick={{ fill: '#ffffff40', fontSize: 11 }} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: '#ffffff30', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#181818', border: '1px solid #333', borderRadius: 8 }} formatter={(v) => [`${v} BPM`]} />
                <Line type="monotone" dataKey="avg_bpm" stroke="#1DB954" strokeWidth={2} dot={{ fill: '#1DB954', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  )
}
