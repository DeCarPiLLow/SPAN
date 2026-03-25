import { useEffect, useState } from 'react'
import { getArtistVelocity } from '../../api/global'
import { PageHeader, LoadingSpinner, EmptyState, Card } from '../../components/ui'

export default function ArtistVelocity() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getArtistVelocity().then(r => { setData(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner message="Calculating artist growth..." />

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader badge="Global" title="Artist Velocity" subtitle="Fastest growing artists by follower count over the past 7 days." />
      {!data.length ? (
        <EmptyState icon="↑" title="No velocity data yet"
          message="Velocity requires weekly follower snapshots. Run the follower polling Celery task to populate this." />
      ) : (
        <Card>
          <div className="space-y-1">
            {data.map((a, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-all">
                <span className="text-white/20 text-sm font-mono w-6 text-right">{i + 1}</span>
                {a.image_url
                  ? <img src={a.image_url} className="w-10 h-10 rounded-full object-cover flex-shrink-0" alt="" />
                  : <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/20 flex-shrink-0">◉</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{a.artist}</p>
                  <p className="text-white/30 text-xs">{(a.followers_now || 0).toLocaleString()} followers</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className={`text-sm font-mono font-bold ${a.velocity >= 0 ? 'text-spotify-green' : 'text-red-400'}`}>
                    {a.velocity >= 0 ? '+' : ''}{a.velocity}%
                  </div>
                  <span className="text-white/20 text-xs">7d</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
