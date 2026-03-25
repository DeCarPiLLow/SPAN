import { useEffect, useState, useCallback } from 'react'
import { getListeningHistory } from '../../api/personal'
import { PageHeader, LoadingSpinner, EmptyState, Card } from '../../components/ui'
import { fmtMs } from '../../utils/formatters'

const TIME_OPTIONS = [
  { label: '1 Hour',   hours: 1   },
  { label: '6 Hours',  hours: 6   },
  { label: '12 Hours', hours: 12  },
  { label: '24 Hours', hours: 24  },
  { label: '2 Days',   hours: 48  },
  { label: '1 Week',   hours: 168 },
  { label: '2 Weeks',  hours: 336 },
  { label: '30 Days',  hours: 720 },
]

function fmtDate(iso) {
  const d = new Date(iso + 'Z')
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr  = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1)  return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr  < 24) return `${diffHr}h ago`
  if (diffDay < 7)  return `${diffDay}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function fmtFull(iso) {
  return new Date(iso + 'Z').toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function ListeningHistory() {
  const [hours, setHours]     = useState(24)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (h) => {
    setLoading(true)
    try {
      const res = await getListeningHistory(h)
      setData(res.data)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load(hours) }, [hours])

  const tracks      = data?.tracks || []
  const totalMs     = tracks.reduce((s, t) => s + (t.duration_ms || 0), 0)
  const uniqueTracks = new Set(tracks.map(t => t.spotify_id)).size
  const uniqueArtists = new Set(tracks.flatMap(t => t.artists)).size

  // Group by date for timeline display
  const grouped = {}
  for (const t of tracks) {
    const day = new Date(t.played_at + 'Z').toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric'
    })
    if (!grouped[day]) grouped[day] = []
    grouped[day].push(t)
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        badge="Personal"
        title="Listening History"
        subtitle="Your play-by-play listening timeline. Choose a window to explore."
      />

      {/* Time window selector */}
      <div className="flex flex-wrap gap-2">
        {TIME_OPTIONS.map(opt => (
          <button
            key={opt.hours}
            onClick={() => setHours(opt.hours)}
            className={`px-4 py-2 rounded-lg text-sm font-mono transition-all border ${
              hours === opt.hours
                ? 'bg-spotify-green text-black font-bold border-spotify-green'
                : 'bg-white/5 text-white/50 border-white/10 hover:text-white hover:border-white/20'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Stats row */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-spotify-green/20 bg-spotify-green/5">
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Tracks Played</p>
            <p className="font-display text-3xl font-bold text-spotify-green mt-1">{tracks.length}</p>
          </Card>
          <Card>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Unique Tracks</p>
            <p className="font-display text-3xl font-bold text-white mt-1">{uniqueTracks}</p>
          </Card>
          <Card>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Unique Artists</p>
            <p className="font-display text-3xl font-bold text-white mt-1">{uniqueArtists}</p>
          </Card>
          <Card>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Time Listened</p>
            <p className="font-display text-3xl font-bold text-white mt-1">
              {totalMs > 3600000
                ? `${(totalMs / 3600000).toFixed(1)}h`
                : `${Math.round(totalMs / 60000)}m`}
            </p>
          </Card>
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading listening history..." />
      ) : !tracks.length ? (
        <EmptyState
          icon="◷"
          title="No history in this window"
          message="Try a longer time window, or sync your data first."
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([day, dayTracks]) => (
            <div key={day}>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-white/40 text-xs font-mono uppercase tracking-wider">{day}</p>
                <span className="text-white/20 text-xs font-mono">· {dayTracks.length} tracks</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>
              <Card className="p-0 overflow-hidden">
                <div className="divide-y divide-white/5">
                  {dayTracks.map((track, i) => (
                    <div
                      key={`${track.played_at}-${i}`}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.03] transition-all group"
                    >
                      {/* Time */}
                      <div className="flex-shrink-0 w-14 text-right">
                        <p className="text-white/25 text-[11px] font-mono" title={fmtFull(track.played_at)}>
                          {new Date(track.played_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      {/* Album art */}
                      {track.image_url ? (
                        <img
                          src={track.image_url}
                          className="w-10 h-10 rounded object-cover flex-shrink-0 group-hover:opacity-90 transition-opacity"
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-white/10 flex-shrink-0 flex items-center justify-center text-white/20">
                          ♪
                        </div>
                      )}

                      {/* Track info */}
                      <div className="flex-1 min-w-0">
                        <a
                          href={track.spotify_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white text-sm font-medium truncate block hover:text-spotify-green transition-colors"
                        >
                          {track.title}
                        </a>
                        <p className="text-white/40 text-xs truncate mt-0.5">
                          {(track.artists || []).join(', ')}
                          {track.album && <span className="text-white/20"> · {track.album}</span>}
                        </p>
                      </div>

                      {/* Right meta */}
                      <div className="flex items-center gap-4 flex-shrink-0">
                        {/* Source badge */}
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full hidden md:block ${
                          track.source === 'recently_played'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-spotify-green/10 text-spotify-green'
                        }`}>
                          {track.source === 'recently_played' ? 'played' : 'top'}
                        </span>

                        {/* Duration */}
                        <span className="text-white/20 text-xs font-mono">
                          {fmtMs(track.duration_ms)}
                        </span>

                        {/* Relative time */}
                        <span className="text-white/15 text-[10px] font-mono hidden lg:block">
                          {fmtDate(track.played_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
