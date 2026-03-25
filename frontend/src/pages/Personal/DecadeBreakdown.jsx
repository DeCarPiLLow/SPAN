import { useEffect, useState } from 'react'
import { getDecadeBreakdown } from '../../api/personal'
import { PageHeader, LoadingSpinner, Card } from '../../components/ui'
import SyncPrompt from '../../components/ui/SyncPrompt'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function DecadeBreakdown() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const load = () => {
    setLoading(true)
    getDecadeBreakdown().then(r => { setData(r.data); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])
  if (loading) return <LoadingSpinner message="Analysing your eras..." />
  const top = data.length ? data.reduce((a,b) => a.count > b.count ? a : b, data[0]) : null
  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader badge="Personal" title="Decade Breakdown" subtitle="Which musical eras dominate your listening?" />
      {!data.length ? <SyncPrompt onDone={load} /> : (
        <>
          {top && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card className="border-spotify-green/20 bg-spotify-green/5">
                <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Favourite Era</p>
                <p className="font-display text-3xl font-bold text-spotify-green mt-1">{top.decade}</p>
                <p className="text-white/40 text-xs mt-1">{top.pct}% of your plays</p>
              </Card>
              <Card>
                <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Eras Explored</p>
                <p className="font-display text-3xl font-bold text-white mt-1">{data.length}</p>
              </Card>
            </div>
          )}
          <Card>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-6">Plays by Decade</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="decade" tick={{ fill: '#ffffff50', fontSize: 12 }} />
                <YAxis tick={{ fill: '#ffffff30', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#181818', border: '1px solid #333', borderRadius: 8 }} formatter={(v) => [`${v} plays`]} />
                <Bar dataKey="count" radius={[4,4,0,0]}>
                  {data.map((entry, i) => <Cell key={i} fill={entry.decade === top?.decade ? '#1DB954' : '#ffffff20'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  )
}
