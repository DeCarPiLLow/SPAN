import { useEffect, useState } from 'react'
import { getMoodMeter, seedGlobalData } from '../../api/global'
import { getMoodDelta } from '../../api/comparison'
import { PageHeader, LoadingSpinner, Card, StatCard } from '../../components/ui'

export default function GlobalMoodMeter() {
  const [meter, setMeter]     = useState(null)
  const [delta, setDelta]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [seedMsg, setSeedMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const [m, d] = await Promise.allSettled([getMoodMeter(), getMoodDelta()])
    if (m.status === 'fulfilled') setMeter(m.value.data)
    if (d.status === 'fulfilled') setDelta(d.value.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSeed = async () => {
    setSeeding(true)
    setSeedMsg('')
    try {
      const res = await seedGlobalData()
      setSeedMsg('Global data seeded! Refreshing...')
      setTimeout(() => { setSeedMsg(''); load() }, 1500)
    } catch (e) {
      setSeedMsg('Seed failed: ' + (e.response?.data?.error || e.message))
    }
    setSeeding(false)
  }

  if (loading) return <LoadingSpinner message="Loading global mood data..." />

  const hasData = meter?.seeded

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader badge="Global" title="Global Mood Meter"
        subtitle="Average emotional fingerprint of Spotify's Global Top 50." />

      {!hasData && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <div className="flex items-start gap-4">
            <span className="text-2xl text-amber-400 flex-shrink-0 mt-0.5">⚠</span>
            <div className="flex-1">
              <p className="text-white font-medium">No global snapshot yet</p>
              <p className="text-white/50 text-sm mt-1 leading-relaxed">
                Click below to fetch the Global Top 50 and country charts now.
                This takes ~30 seconds and uses your Spotify account to read public chart data.
              </p>
              {seedMsg && (
                <p className={`text-sm font-mono mt-2 ${seedMsg.includes('failed') ? 'text-red-400' : 'text-spotify-green'}`}>
                  {seedMsg}
                </p>
              )}
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-spotify-green hover:bg-green-400 disabled:opacity-50 text-black font-bold rounded-lg text-sm transition-all"
              >
                {seeding
                  ? <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Fetching charts...</>
                  : <><span>↓</span> Seed Global Data Now</>
                }
              </button>
            </div>
          </div>
        </Card>
      )}

      {hasData && (
        <>
          <div className="flex justify-between items-center flex-wrap gap-3">
            <p className="text-white/30 text-xs font-mono">
              Snapshot: {meter.snapshot_date}
            </p>
            <button onClick={handleSeed} disabled={seeding}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white rounded-lg text-xs font-mono transition-all">
              {seeding ? 'Refreshing...' : '↻ Refresh Data'}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Valence"      value={`${(meter.avg_valence * 100).toFixed(0)}%`}      sub="happiness"    accent />
            <StatCard label="Energy"       value={`${(meter.avg_energy * 100).toFixed(0)}%`}       sub="intensity"    />
            <StatCard label="Danceability" value={`${(meter.avg_danceability * 100).toFixed(0)}%`} sub="groove"       />
            <StatCard label="Avg BPM"      value={Math.round(meter.avg_tempo || 0)}                sub="tempo"        />
          </div>

          {delta?.user && Object.keys(delta.global || {}).length > 0 && (
            <Card>
              <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-5">Your Mood vs. Global</p>
              <div className="space-y-5">
                {[['energy','Energy'], ['valence','Valence'], ['danceability','Danceability']].map(([k, label]) => {
                  const userVal   = delta.user?.[k]   || 0
                  const globalVal = delta.global?.[k] || 0
                  const d         = delta.delta?.[k]  || 0
                  return (
                    <div key={k} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-white/60 text-sm font-mono uppercase tracking-wide">{label}</span>
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                          d > 0.05 ? 'bg-spotify-green/10 text-spotify-green' :
                          d < -0.05 ? 'bg-red-500/10 text-red-400' :
                          'bg-white/5 text-white/30'
                        }`}>
                          {d > 0 ? '+' : ''}{(d * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                          <span className="text-white/20 text-[10px] font-mono w-12 text-right">Global</span>
                          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-white/25" style={{ width: `${globalVal * 100}%` }} />
                          </div>
                          <span className="text-white/20 text-[10px] font-mono w-8">{(globalVal * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-spotify-green/60 text-[10px] font-mono w-12 text-right">You</span>
                          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-spotify-green" style={{ width: `${userVal * 100}%` }} />
                          </div>
                          <span className="text-white/20 text-[10px] font-mono w-8">{(userVal * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {meter.top_genres && Object.keys(meter.top_genres).length > 0 && (
            <Card>
              <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-4">Top Global Genres</p>
              <div className="space-y-2">
                {Object.entries(meter.top_genres).slice(0, 12).map(([genre, count], i) => {
                  const max = Math.max(...Object.values(meter.top_genres))
                  return (
                    <div key={genre} className="flex items-center gap-3">
                      <span className="text-white/20 text-xs font-mono w-4 text-right">{i + 1}</span>
                      <span className="text-white/60 text-sm capitalize w-36 truncate">{genre}</span>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-spotify-green/60 rounded-full transition-all duration-500"
                          style={{ width: `${(count / max) * 100}%` }} />
                      </div>
                      <span className="text-white/20 text-xs font-mono w-6 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
