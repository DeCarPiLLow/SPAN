import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import { getMe } from '../api/auth'
import { getPersona, getDiscovery, getMoodRadar } from '../api/personal'
import { syncData } from '../api/personal'
import { Card, StatCard, LoadingSpinner } from '../components/ui'
import { fmtPct } from '../utils/formatters'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts'

const FEATURE_CARDS = [
  { label: 'Listening Clock',  path: '/app/listening-clock', icon: '◷', desc: '24-hour listening heatmap' },
  { label: 'Mood Radar',       path: '/app/mood-radar',      icon: '◈', desc: 'Energy, valence & more' },
  { label: 'Genre Evolution',  path: '/app/genre-evolution', icon: '▦', desc: 'Your taste over time' },
  { label: 'My Persona',       path: '/app/persona',         icon: '◉', desc: 'Explorer, Traveler & more' },
  { label: 'Top Tracks',       path: '/app/top-tracks',      icon: '♪', desc: 'Your most played songs' },
  { label: 'Mainstream Score', path: '/app/mainstream',      icon: '⊕', desc: 'How mainstream are you?' },
  { label: 'Taste Twin',       path: '/app/taste-twin',      icon: '≈', desc: 'Which country shares your taste?' },
  { label: 'My Receipt',       path: '/app/receipt',         icon: '◻', desc: 'Shareable listening summary' },
]

export default function Dashboard() {
  const { user, setUser } = useAuthStore()
  const [persona, setPersona]     = useState(null)
  const [discovery, setDiscovery] = useState(null)
  const [radar, setRadar]         = useState(null)
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState(false)
  const [syncDone, setSyncDone]   = useState(false)
  const [noData, setNoData]       = useState(false)

  const loadAnalytics = async () => {
    const [meRes, personaRes, discRes, radarRes] = await Promise.allSettled([
      getMe(), getPersona(), getDiscovery(), getMoodRadar()
    ])
    if (meRes.status === 'fulfilled')      setUser(meRes.value.data)
    if (personaRes.status === 'fulfilled') setPersona(personaRes.value.data)
    if (discRes.status === 'fulfilled')    setDiscovery(discRes.value.data)
    if (radarRes.status === 'fulfilled')   setRadar(radarRes.value.data)

    // Check if we have any meaningful data
    const disc = discRes.status === 'fulfilled' ? discRes.value.data : null
    if (!disc || disc.total_plays === 0) setNoData(true)
    else setNoData(false)
  }

  useEffect(() => {
    loadAnalytics().finally(() => setLoading(false))
  }, [])

  const handleFirstSync = async () => {
    setSyncing(true)
    try {
      await syncData()
      setSyncDone(true)
      setNoData(false)
      await loadAnalytics()
    } catch {}
    setSyncing(false)
  }

  const radarData = radar ? [
    { axis: 'Energy',       value: radar.energy       || 0 },
    { axis: 'Valence',      value: radar.valence      || 0 },
    { axis: 'Dance',        value: radar.danceability || 0 },
    { axis: 'Acoustic',     value: radar.acousticness || 0 },
    { axis: 'Instrumental', value: radar.instrumentalness || 0 },
    { axis: 'Live',         value: radar.liveness     || 0 },
  ] : []

  if (loading) return <LoadingSpinner message="Loading your dashboard..." />

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/30 text-xs font-mono uppercase tracking-widest mb-1">Welcome back</p>
          <h1 className="font-display text-4xl font-bold text-white">{user?.display_name || 'Listener'}</h1>
          <p className="text-white/40 text-sm mt-1">
            {user?.last_synced
              ? `Last synced ${new Date(user.last_synced).toLocaleDateString()}`
              : 'First time? Hit Sync to load your history.'}
          </p>
        </div>
        {user?.avatar_url && (
          <img src={user.avatar_url} className="w-14 h-14 rounded-full ring-2 ring-spotify-green/30" alt="" />
        )}
      </div>

      {/* First-time sync CTA */}
      {noData && (
        <div className="rounded-xl border border-spotify-green/20 bg-spotify-green/5 p-6 flex flex-col md:flex-row items-center gap-6">
          <div className="text-4xl flex-shrink-0">🎵</div>
          <div className="flex-1 text-center md:text-left">
            <p className="text-white font-display font-bold text-lg">Ready to dive in?</p>
            <p className="text-white/50 text-sm mt-1">
              Sync your Spotify data to unlock all dashboards — mood radar, listening clock, genre evolution, and more.
            </p>
          </div>
          <button onClick={handleFirstSync} disabled={syncing}
            className="flex-shrink-0 flex items-center gap-2 px-6 py-3 bg-spotify-green hover:bg-green-400 disabled:opacity-60 text-black font-display font-bold rounded-xl transition-all">
            <span className={syncing ? 'animate-spin inline-block' : ''}>↻</span>
            {syncing ? 'Syncing...' : syncDone ? '✓ Synced!' : 'Sync My Data'}
          </button>
        </div>
      )}

      {/* Stats */}
      {!noData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Persona"    value={persona?.persona?.split(' ').slice(-1)[0] || '—'} sub={persona?.persona || '—'} accent />
          <StatCard label="Discovery"  value={discovery ? fmtPct(discovery.ratio) : '—'} sub="new tracks / 30 days" />
          <StatCard label="New Finds"  value={discovery?.new_finds ?? '—'} sub="in last 30 days" />
          <StatCard label="Total Plays" value={discovery?.total_plays ?? '—'} sub="in history" />
        </div>
      )}

      {/* Radar + Persona */}
      {!noData && (radar || persona) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {radar && Object.values(radar).some(v => v > 0) && (
            <Card>
              <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-4">Mood snapshot</p>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#ffffff10" />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: '#ffffff50', fontSize: 11, fontFamily: 'DM Mono' }} />
                  <Radar dataKey="value" stroke="#1DB954" fill="#1DB954" fillOpacity={0.15} strokeWidth={1.5} />
                </RadarChart>
              </ResponsiveContainer>
              <Link to="/app/mood-radar" className="text-spotify-green text-xs font-mono hover:underline mt-2 block">Full analysis →</Link>
            </Card>
          )}
          {persona && (
            <Card className="flex flex-col justify-between">
              <div>
                <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-3">Your persona</p>
                <div className="inline-flex items-center gap-2 bg-spotify-green/10 border border-spotify-green/20 rounded-lg px-4 py-2 mb-3">
                  <span className="text-spotify-green text-2xl">◉</span>
                  <span className="font-display font-bold text-white text-xl">{persona.persona}</span>
                </div>
                <p className="text-white/50 text-sm leading-relaxed">{persona.reason}</p>
              </div>
              <div className="mt-4 flex gap-4 text-sm">
                <div>
                  <p className="text-white/30 text-xs font-mono">Avg. Release Year</p>
                  <p className="text-white font-bold">{persona.avg_release_year}</p>
                </div>
                <div>
                  <p className="text-white/30 text-xs font-mono">Discovery Rate</p>
                  <p className="text-white font-bold">{fmtPct(persona.discovery_ratio)}</p>
                </div>
              </div>
              <Link to="/app/persona" className="text-spotify-green text-xs font-mono hover:underline mt-4 block">See full persona →</Link>
            </Card>
          )}
        </div>
      )}

      {/* Feature grid */}
      <div>
        <p className="text-white/30 text-xs font-mono uppercase tracking-widest mb-4">Explore Features</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {FEATURE_CARDS.map(f => (
            <Link key={f.path} to={f.path}
              className="group bg-spotify-card hover:bg-spotify-hover border border-white/5 hover:border-spotify-green/20 rounded-xl p-4 transition-all duration-200">
              <span className="text-2xl block mb-2 text-white/40 group-hover:text-spotify-green transition-colors">{f.icon}</span>
              <p className="font-display font-semibold text-white text-sm">{f.label}</p>
              <p className="text-white/30 text-xs mt-0.5">{f.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
