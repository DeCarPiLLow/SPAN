import { useEffect, useState } from 'react'
import { getMoodRadar } from '../../api/personal'
import { PageHeader, LoadingSpinner, Card, ProgressBar } from '../../components/ui'
import SyncPrompt from '../../components/ui/SyncPrompt'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts'

const DESC = {
  energy: 'How energetic and intense the music feels.',
  valence: 'Musical positiveness — higher means happier.',
  danceability: 'How suitable the tracks are for dancing.',
  acousticness: 'Confidence the track is acoustic.',
  instrumentalness: 'Predicts whether a track has no vocals.',
  liveness: 'Detects the presence of a live audience.',
}

export default function MoodRadar() {
  const [data, setData]   = useState(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    getMoodRadar().then(r => { setData(r.data); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  if (loading) return <LoadingSpinner message="Computing your mood profile..." />

  const hasData = data && Object.values(data).some(v => v > 0)

  const radarData = hasData ? [
    { axis: 'Energy',       value: data.energy },
    { axis: 'Valence',      value: data.valence },
    { axis: 'Danceability', value: data.danceability },
    { axis: 'Acoustic',     value: data.acousticness },
    { axis: 'Instrumental', value: data.instrumentalness },
    { axis: 'Liveness',     value: data.liveness },
  ] : []

  const dominant = hasData ? Object.entries(data).sort((a,b) => b[1]-a[1])[0] : null

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader badge="Personal" title="Mood Radar" subtitle="Six audio dimensions averaged across your listening history." />
      {!hasData ? <SyncPrompt onDone={load} /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-2">Radar Chart</p>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <PolarGrid stroke="#ffffff08" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: '#ffffff60', fontSize: 12, fontFamily: 'DM Mono' }} />
                <Radar dataKey="value" stroke="#1DB954" fill="#1DB954" fillOpacity={0.2} strokeWidth={2}
                  dot={{ fill: '#1DB954', r: 3 }} />
                <Tooltip formatter={(v) => (v * 100).toFixed(1) + '%'}
                  contentStyle={{ background: '#181818', border: '1px solid #333', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }} />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-4">Dimension Scores</p>
            <div className="space-y-4">
              {Object.entries(data).map(([key, val]) => (
                <ProgressBar key={key} label={key} value={val} max={1} pct={`${(val * 100).toFixed(1)}%`} />
              ))}
            </div>
            {dominant && (
              <div className="mt-6 p-3 rounded-lg bg-spotify-green/5 border border-spotify-green/20">
                <p className="text-spotify-green text-xs font-mono uppercase tracking-wider">Dominant trait</p>
                <p className="text-white font-display font-bold mt-1 capitalize">{dominant[0]}</p>
                <p className="text-white/40 text-xs mt-1">{DESC[dominant[0]]}</p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
