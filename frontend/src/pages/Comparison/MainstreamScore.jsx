import { useEffect, useState } from 'react'
import { getMainstreamScore } from '../../api/comparison'
import { PageHeader, LoadingSpinner, EmptyState, Card, StatCard } from '../../components/ui'

export default function MainstreamScore() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMainstreamScore().then(r => { setData(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner message="Calculating your mainstream score..." />

  const score = data?.score || 0
  const label = score >= 70 ? 'Mainstream Maven' : score >= 40 ? 'Middle Ground' : score >= 15 ? 'Alternative' : 'Underground'
  const color = score >= 70 ? 'text-pink-400' : score >= 40 ? 'text-yellow-400' : score >= 15 ? 'text-blue-400' : 'text-spotify-green'

  const circumference = 2 * Math.PI * 54
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader badge="Compare" title="Mainstream Score" subtitle="How much do your top tracks overlap with the Global Top 100?" />
      {!data ? (
        <EmptyState icon="⊕" title="No data yet" message="Sync your data and ensure global snapshots exist." />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="flex flex-col items-center justify-center py-8">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="#ffffff0a" strokeWidth="8" />
                  <circle cx="60" cy="60" r="54" fill="none" stroke="#1DB954" strokeWidth="8"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round" className="transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-4xl font-bold text-white">{Math.round(score)}</span>
                  <span className="text-white/30 text-xs font-mono">/ 100</span>
                </div>
              </div>
              <p className={`font-display text-2xl font-bold mt-4 ${color}`}>{label}</p>
              <p className="text-white/40 text-sm mt-1 text-center px-4">
                {score >= 70 ? "You love what the world loves." : score >= 40 ? "A balanced mix of hits and hidden gems." : score >= 15 ? "You lean away from the charts." : "Deep in the underground — rare taste."}
              </p>
            </Card>
            <div className="grid grid-cols-2 gap-4 content-start">
              <StatCard label="Score"         value={`${Math.round(score)}/100`} accent />
              <StatCard label="Overlap"        value={data.overlap_count || 0} sub="tracks in Global Top 100" />
              <StatCard label="Your Top Tracks" value={data.user_top_count || 0} sub="analysed" />
              <StatCard label="Label"          value={label} />
            </div>
          </div>
          <Card>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-3">How it's calculated</p>
            <p className="text-white/50 text-sm leading-relaxed">
              We compare your top {data.user_top_count} most-played tracks against the Spotify Global Top 100. 
              Score = (overlapping tracks / your top track count) × 100. 
              A score of 0 means none of your favourites appear on the global charts. 
              100 means your entire top list is on the global charts.
            </p>
          </Card>
        </>
      )}
    </div>
  )
}
