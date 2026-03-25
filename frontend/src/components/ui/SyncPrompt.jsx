import { useState } from 'react'
import { syncData } from '../../api/personal'

export default function SyncPrompt({ onDone }) {
  const [syncing, setSyncing]   = useState(false)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState('')

  const handleSync = async () => {
    setSyncing(true)
    setError('')
    try {
      const res = await syncData()
      setResult(res.data)
      if (onDone) setTimeout(onDone, 1500)
    } catch (e) {
      setError(e.response?.data?.message || 'Sync failed. Check your connection.')
    }
    setSyncing(false)
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-spotify-green/10 border border-spotify-green/20 flex items-center justify-center">
        <span className="text-spotify-green text-3xl">↻</span>
      </div>
      <div>
        <p className="text-white font-display font-semibold text-lg">No data yet</p>
        <p className="text-white/40 text-sm mt-1 max-w-xs">
          Sync your Spotify listening history to populate this dashboard.
          This fetches your top tracks, recent plays, and audio features.
        </p>
      </div>

      {result ? (
        <div className="bg-spotify-green/10 border border-spotify-green/20 rounded-xl px-6 py-4 text-center">
          <p className="text-spotify-green font-mono text-sm font-bold">✓ Sync complete!</p>
          <p className="text-white/50 text-xs mt-1">
            {result.synced_recently_played} recent plays · {result.synced_top_tracks} top tracks loaded
          </p>
          <p className="text-white/30 text-xs mt-1">Reload the page to see your data.</p>
        </div>
      ) : (
        <button onClick={handleSync} disabled={syncing}
          className="flex items-center gap-2 px-6 py-3 bg-spotify-green hover:bg-green-400 disabled:opacity-60 text-black font-display font-bold rounded-xl transition-all">
          <span className={syncing ? 'animate-spin inline-block' : ''}>↻</span>
          {syncing ? 'Syncing...' : 'Sync My Data'}
        </button>
      )}

      {error && <p className="text-red-400/80 text-xs font-mono">{error}</p>}
    </div>
  )
}
