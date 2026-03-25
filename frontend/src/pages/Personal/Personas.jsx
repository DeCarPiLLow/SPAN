import { useEffect, useState } from 'react'
import { getPersona } from '../../api/personal'
import { PageHeader, LoadingSpinner, Card, StatCard } from '../../components/ui'
import SyncPrompt from '../../components/ui/SyncPrompt'

const PERSONA_META = {
  'The Time Traveler':    { icon: '⧖', color: 'text-amber-400',    bg: 'bg-amber-400/10 border-amber-400/20',    desc: 'You live in musical eras gone by. Pre-2000 anthems define your soundscape.' },
  'The Explorer':        { icon: '◎', color: 'text-spotify-green', bg: 'bg-spotify-green/10 border-spotify-green/20', desc: 'Always first to discover. You track new artists before they chart.' },
  'The Comfort Listener':{ icon: '♡', color: 'text-blue-400',      bg: 'bg-blue-400/10 border-blue-400/20',      desc: 'Your playlist is a warm blanket. Familiar sounds over novelty, every time.' },
  'The Trend Surfer':    { icon: '↑', color: 'text-pink-400',      bg: 'bg-pink-400/10 border-pink-400/20',      desc: 'High energy, high valence—you ride the current wave. Charts are your home.' },
}

export default function Personas() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const load = () => {
    setLoading(true)
    getPersona().then(r => { setData(r.data); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  if (loading) return <LoadingSpinner message="Calculating your persona..." />
  if (!data)   return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader badge="Personal" title="Your Persona" subtitle="A rule-based personality derived from your listening habits." />
      <SyncPrompt onDone={load} />
    </div>
  )

  const meta = PERSONA_META[data.persona] || PERSONA_META['The Explorer']

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader badge="Personal" title="Your Persona" subtitle="A rule-based personality derived from your listening habits." />
      <Card className={`border ${meta.bg}`}>
        <div className="flex items-start gap-6">
          <div className={`text-6xl ${meta.color} flex-shrink-0`}>{meta.icon}</div>
          <div>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider">You are</p>
            <h2 className={`font-display text-3xl font-bold mt-1 ${meta.color}`}>{data.persona}</h2>
            <p className="text-white/60 mt-2 leading-relaxed">{meta.desc}</p>
            <p className="text-white/40 text-sm mt-3 italic">"{data.reason}"</p>
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Avg Release Year" value={data.avg_release_year} sub="your typical era" />
        <StatCard label="Discovery Rate"   value={`${(data.discovery_ratio * 100).toFixed(1)}%`} sub="new tracks / 30 days" />
        {data.mood && <>
          <StatCard label="Energy"      value={`${(data.mood.energy * 100).toFixed(0)}%`} />
          <StatCard label="Valence"     value={`${(data.mood.valence * 100).toFixed(0)}%`} />
          <StatCard label="Danceability"value={`${(data.mood.danceability * 100).toFixed(0)}%`} />
          <StatCard label="Acousticness" value={`${(data.mood.acousticness * 100).toFixed(0)}%`} />
          <StatCard label="Instrumentalness" value={`${(data.mood.instrumentalness * 100).toFixed(0)}%`} />
          <StatCard label="Speechiness" value={`${(data.mood.speechiness * 100).toFixed(0)}%`} />
          <StatCard label="Liveness" value={`${(data.mood.liveness * 100).toFixed(0)}%`} />
        </>}
      </div>
      <div>
        <p className="text-white/30 text-xs font-mono uppercase tracking-widest mb-4">All Personas</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(PERSONA_META).map(([name, m]) => (
            <Card key={name} className={`border ${data.persona === name ? m.bg : 'border-white/5'} transition-all`}>
              <div className="flex items-center gap-3">
                <span className={`text-2xl ${data.persona === name ? m.color : 'text-white/20'}`}>{m.icon}</span>
                <div>
                  <p className={`font-display font-semibold ${data.persona === name ? m.color : 'text-white/40'}`}>{name}</p>
                  <p className="text-white/30 text-xs mt-0.5">{m.desc.split('.')[0]}.</p>
                </div>
                {data.persona === name && <span className="ml-auto text-xs font-mono bg-white/10 px-2 py-0.5 rounded-full text-white/60">YOU</span>}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
