import { useEffect, useState } from 'react'
import { getReceipt } from '../../api/comparison'
import { PageHeader, LoadingSpinner, EmptyState, Card, StatCard } from '../../components/ui'

export default function Receipt() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getReceipt().then(r => { setData(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner message="Building your receipt..." />
  if (!data)   return <EmptyState icon="◻" title="No receipt data" message="Sync your data first." />

  const API = import.meta.env.VITE_API_BASE_URL || '/api'

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader badge="Engage" title="My Receipt" subtitle="Your shareable listening summary — perfect for Instagram stories." />

      {/* Preview Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-spotify-green/20">
          <div className="font-mono space-y-4">
            <div className="text-center border-b border-dashed border-white/10 pb-4">
              <p className="text-spotify-green font-bold text-lg">♪ SPOTIFY ANALYZER</p>
              <p className="text-white font-bold text-2xl mt-1">{data.display_name}</p>
              <div className="inline-block bg-spotify-green text-black text-sm font-bold px-4 py-1 rounded-lg mt-2">
                {data.persona}
              </div>
            </div>

            <div>
              <p className="text-white/30 text-xs uppercase tracking-widest mb-2">— TOP TRACKS —</p>
              {(data.top_tracks || []).map((t, i) => (
                <div key={i} className="flex items-center gap-2 py-1">
                  <span className="text-spotify-green text-xs">{i + 1}.</span>
                  <div>
                    <span className="text-white text-sm">{t.title}</span>
                    <span className="text-white/40 text-xs ml-2">{t.artist}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-white/10 pt-4">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-2">— SOUND —</p>
              <p className="text-white text-sm">{(data.top_genres || []).map(g => g.toUpperCase()).join('  ·  ') || 'VARIED'}</p>
            </div>

            <div className="grid grid-cols-3 border-t border-dashed border-white/10 pt-4 text-center">
              <div>
                <p className="text-spotify-green font-bold text-xl">{data.mainstream_score}%</p>
                <p className="text-white/30 text-xs">MAINSTREAM</p>
              </div>
              <div>
                <p className="text-spotify-green font-bold text-xl">{Math.round((data.discovery_ratio || 0) * 100)}%</p>
                <p className="text-white/30 text-xs">DISCOVERY</p>
              </div>
              <div>
                <p className="text-spotify-green font-bold text-xl">{Math.round((data.obscurity_index || 0) * 100)}%</p>
                <p className="text-white/30 text-xs">OBSCURITY</p>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-3">Download Image</p>
            <p className="text-white/50 text-sm mb-4">Get a high-resolution 1080×1920 PNG perfect for Instagram stories.</p>
            <a
              href={`${API}/engage/receipt/image`}
              download="my-spotify-receipt.png"
              className="flex items-center justify-center gap-2 w-full bg-spotify-green hover:bg-green-400 text-black font-bold py-3 rounded-lg transition-all"
            >
              <span>↓</span> Download Receipt PNG
            </a>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Persona"    value={data.persona?.split(' ').slice(-1)[0]} accent />
            <StatCard label="Mainstream" value={`${data.mainstream_score}%`} />
            <StatCard label="Discovery"  value={`${Math.round((data.discovery_ratio || 0) * 100)}%`} />
            <StatCard label="Obscurity"  value={`${Math.round((data.obscurity_index || 0) * 100)}%`} />
          </div>
        </div>
      </div>
    </div>
  )
}
