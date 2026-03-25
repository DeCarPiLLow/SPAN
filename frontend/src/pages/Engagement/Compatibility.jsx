import { useState } from 'react'
import { getCompatibility } from '../../api/comparison'
import { PageHeader, Card, StatCard, LoadingSpinner } from '../../components/ui'

export default function Compatibility() {
  const [spotifyId, setSpotifyId] = useState('')
  const [result, setResult]       = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const handleCheck = async () => {
    if (!spotifyId.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await getCompatibility(spotifyId.trim())
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.error || 'Could not compute compatibility. Make sure the partner has also used Spotify Analyzer.')
    }
    setLoading(false)
  }

  const score = result?.score || 0
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader badge="Engage" title="Music Compatibility" subtitle="Compare your taste with another Spotify Analyzer user using genre & mood similarity." />

      <Card>
        <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-4">Enter Partner's Spotify ID</p>
        <div className="flex gap-3">
          <input
            type="text"
            value={spotifyId}
            onChange={e => setSpotifyId(e.target.value)}
            placeholder="e.g. spotify:user:31xxxxx"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-spotify-green/50 placeholder-white/20 transition-colors"
            onKeyDown={e => e.key === 'Enter' && handleCheck()}
          />
          <button onClick={handleCheck} disabled={loading || !spotifyId.trim()}
            className="px-6 py-3 bg-spotify-green hover:bg-green-400 disabled:opacity-40 text-black font-bold rounded-lg transition-all text-sm">
            {loading ? '...' : 'Check'}
          </button>
        </div>
        {error && <p className="text-red-400/80 text-xs font-mono mt-3">{error}</p>}
        <p className="text-white/20 text-xs mt-3">Find a Spotify ID at open.spotify.com → your profile → share → copy link</p>
      </Card>

      {loading && <LoadingSpinner message="Computing compatibility..." />}

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
          <Card className="flex flex-col items-center py-8">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="#ffffff0a" strokeWidth="8" />
                <circle cx="60" cy="60" r="54" fill="none"
                  stroke={score >= 70 ? '#1DB954' : score >= 50 ? '#facc15' : '#f87171'}
                  strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={offset}
                  strokeLinecap="round" className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-4xl font-bold text-white">{Math.round(score)}</span>
                <span className="text-white/30 text-xs font-mono">/ 100</span>
              </div>
            </div>
            <p className="font-display text-2xl font-bold mt-4 text-white">
              {score >= 80 ? 'Soul Mates 🎵' : score >= 60 ? 'Great Match ♪' : score >= 40 ? 'Some Overlap' : 'Different Worlds'}
            </p>
            {result.partner && (
              <p className="text-white/40 text-sm mt-2">vs. {result.partner.display_name}</p>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-4 content-start">
            <StatCard label="Overall Score"    value={`${Math.round(score)}%`} accent />
            <StatCard label="Genre Similarity" value={`${result.breakdown?.genre_similarity || 0}%`} />
            <StatCard label="Mood Similarity"  value={`${result.breakdown?.mood_similarity || 0}%`} />
            <Card>
              <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Verdict</p>
              <p className="text-white font-medium mt-1 text-sm">
                {score >= 70 ? 'You would love each other\'s playlists.' : score >= 40 ? 'Some common ground — make a shared playlist!' : 'Your tastes diverge — but opposites attract!'}
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
