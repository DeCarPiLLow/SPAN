import { useEffect, useState } from 'react'
import { getTopTracks, getTopArtists } from '../../api/personal'
import { PageHeader, LoadingSpinner, EmptyState, Card, TimeRangeSelector } from '../../components/ui'
import { fmtMs } from '../../utils/formatters'

export default function TopTracks() {
  const [range, setRange]     = useState('medium_term')
  const [tracks, setTracks]   = useState(null)
  const [artists, setArtists] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('tracks')

  useEffect(() => {
    setLoading(true)
    Promise.allSettled([getTopTracks(range), getTopArtists(range)]).then(([t, a]) => {
      if (t.status === 'fulfilled') setTracks(t.value.data.items || [])
      if (a.status === 'fulfilled') setArtists(a.value.data.items || [])
      setLoading(false)
    })
  }, [range])

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader badge="Personal" title="Top Tracks & Artists" subtitle="Your most-played music across different time windows." />
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {['tracks','artists'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-mono transition-all ${tab === t ? 'bg-spotify-green text-black font-bold' : 'text-white/50 hover:text-white'}`}>
              {t}
            </button>
          ))}
        </div>
        <TimeRangeSelector value={range} onChange={setRange} />
      </div>

      {loading ? <LoadingSpinner /> : tab === 'tracks' ? (
        <Card>
          {!tracks?.length ? <EmptyState icon="♪" title="No tracks yet" message="Sync your data first." /> : (
            <div className="space-y-1">
              {tracks.map((t, i) => {
                const img = t.album?.images?.[2]?.url || t.album?.images?.[0]?.url
                const artists = t.artists?.map(a => a.name).join(', ')
                return (
                  <div key={t.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-all group">
                    <span className="text-white/20 text-sm font-mono w-6 text-right flex-shrink-0">{i + 1}</span>
                    {img && <img src={img} className="w-10 h-10 rounded object-cover flex-shrink-0" alt="" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{t.name}</p>
                      <p className="text-white/40 text-xs truncate">{artists}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className="text-white/20 text-xs font-mono hidden md:block">{t.album?.name?.slice(0,20)}</span>
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden hidden md:block">
                          <div className="h-full bg-spotify-green/60 rounded-full" style={{ width: `${t.popularity || 0}%` }} />
                        </div>
                        <span className="text-white/20 text-xs font-mono">{fmtMs(t.duration_ms)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {!artists?.length ? <EmptyState icon="◉" title="No artists yet" message="Sync your data first." /> :
            artists.map((a, i) => {
              const img = a.images?.[1]?.url || a.images?.[0]?.url
              return (
                <Card key={a.id} className="flex flex-col items-center gap-3 text-center">
                  <div className="relative">
                    <span className="absolute -top-1 -left-1 bg-spotify-card text-white/40 text-xs font-mono w-5 h-5 flex items-center justify-center rounded-full border border-white/10">
                      {i + 1}
                    </span>
                    {img
                      ? <img src={img} className="w-16 h-16 rounded-full object-cover ring-2 ring-white/10" alt="" />
                      : <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl">◉</div>
                    }
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium truncate max-w-full">{a.name}</p>
                    <p className="text-white/30 text-xs mt-0.5">{a.genres?.[0] || 'artist'}</p>
                  </div>
                </Card>
              )
            })
          }
        </div>
      )}
    </div>
  )
}
