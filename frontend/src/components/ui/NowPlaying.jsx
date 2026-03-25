import { useEffect, useRef, useState, useCallback } from 'react'
import * as playerApi from '../../api/player'
import { fmtMs } from '../../utils/formatters'
import clsx from 'clsx'

function ProgressBar({ progress, duration, onSeek }) {
  const barRef  = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [localPct, setLocalPct] = useState(null)

  const pct = localPct !== null ? localPct : (duration > 0 ? progress / duration : 0)

  const handleMouseDown = (e) => {
    setDragging(true)
    updateFromEvent(e)
  }
  const updateFromEvent = (e) => {
    if (!barRef.current) return
    const rect = barRef.current.getBoundingClientRect()
    const p    = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setLocalPct(p)
  }
  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => updateFromEvent(e)
    const onUp   = (e) => {
      updateFromEvent(e)
      const p = Math.max(0, Math.min(1, (e.clientX - (barRef.current?.getBoundingClientRect().left || 0)) / (barRef.current?.getBoundingClientRect().width || 1)))
      onSeek(Math.round(p * duration))
      setTimeout(() => setLocalPct(null), 800)
      setDragging(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging, duration])

  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-white/30 text-[10px] font-mono w-8 text-right flex-shrink-0">{fmtMs(progress)}</span>
      <div ref={barRef} onMouseDown={handleMouseDown}
        className="flex-1 h-1 bg-white/10 rounded-full cursor-pointer group relative">
        <div className="h-full bg-spotify-green rounded-full relative transition-none"
          style={{ width: `${pct * 100}%` }}>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full
            opacity-0 group-hover:opacity-100 transition-opacity shadow-md" />
        </div>
      </div>
      <span className="text-white/30 text-[10px] font-mono w-8 flex-shrink-0">{fmtMs(duration)}</span>
    </div>
  )
}

function VolumeControl({ volume, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/30 text-xs">
        {volume === 0 ? '🔇' : volume < 40 ? '🔈' : volume < 70 ? '🔉' : '🔊'}
      </span>
      <input type="range" min="0" max="100" value={volume}
        onChange={e => onChange(Number(e.target.value))}
        className="w-20 h-1 accent-spotify-green cursor-pointer"
        style={{ accentColor: '#1DB954' }}
      />
    </div>
  )
}

export default function NowPlaying() {
  const [state, setState]       = useState(null)   // full playback state
  const [queue, setQueue]       = useState([])
  const [showQueue, setShowQueue] = useState(false)
  const [progress, setProgress] = useState(0)
  const [vol, setVol]           = useState(50)
  const [volTimer, setVolTimer] = useState(null)
  const [collapsed, setCollapsed] = useState(false)
  const pollRef  = useRef(null)
  const tickRef  = useRef(null)

  const fetchState = useCallback(async () => {
    try {
      const res = await playerApi.getNowPlaying()
      const d   = res.data
      setState(d)
      setProgress(d.progress_ms || 0)
      setVol(d.device?.volume_percent ?? 50)
    } catch { setState(null) }
  }, [])

  // Poll every 5 seconds
  useEffect(() => {
    fetchState()
    pollRef.current = setInterval(fetchState, 5000)
    return () => clearInterval(pollRef.current)
  }, [fetchState])

  // Local progress tick every second when playing
  useEffect(() => {
    clearInterval(tickRef.current)
    if (state?.is_playing && state?.item) {
      tickRef.current = setInterval(() => {
        setProgress(p => Math.min(p + 1000, state.item.duration_ms))
      }, 1000)
    }
    return () => clearInterval(tickRef.current)
  }, [state?.is_playing, state?.item?.id])

  const handlePlayPause = async () => {
    if (!state) return
    if (state.is_playing) {
      await playerApi.pause()
      setState(s => ({ ...s, is_playing: false }))
    } else {
      await playerApi.play()
      setState(s => ({ ...s, is_playing: true }))
    }
  }

  const handleNext = async () => {
    await playerApi.next()
    setTimeout(fetchState, 500)
  }

  const handlePrev = async () => {
    await playerApi.prev()
    setTimeout(fetchState, 500)
  }

  const handleSeek = async (ms) => {
    setProgress(ms)
    await playerApi.seek(ms)
  }

  const handleVolume = (v) => {
    setVol(v)
    clearTimeout(volTimer)
    setVolTimer(setTimeout(() => playerApi.setVolume(v), 400))
  }

  const handleShuffle = async () => {
    const next = !state.shuffle_state
    setState(s => ({ ...s, shuffle_state: next }))
    await playerApi.setShuffle(next)
  }

  const handleRepeat = async () => {
    const cycle = { 'off': 'context', 'context': 'track', 'track': 'off' }
    const next  = cycle[state.repeat_state] || 'off'
    setState(s => ({ ...s, repeat_state: next }))
    await playerApi.setRepeat(next)
  }

  const fetchQueue = async () => {
    try {
      const res = await playerApi.getQueue()
      setQueue(res.data.queue || [])
    } catch {}
  }

  const toggleQueue = () => {
    if (!showQueue) fetchQueue()
    setShowQueue(q => !q)
  }

  // Nothing playing
  if (!state?.item) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 border-t border-white/5 backdrop-blur-md">
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-white/20 text-xs flex-shrink-0">♪</div>
          <p className="text-white/25 text-xs font-mono">Nothing playing — open Spotify and start a track</p>
        </div>
      </div>
    )
  }

  const { item, is_playing, shuffle_state, repeat_state, device } = state

  return (
    <>
      {/* Queue panel */}
      {showQueue && (
        <div className="fixed bottom-[72px] right-4 z-50 w-80 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-slide-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <p className="text-white font-display font-semibold text-sm">Queue</p>
            <button onClick={() => setShowQueue(false)} className="text-white/30 hover:text-white text-lg leading-none">×</button>
          </div>
          <div className="overflow-y-auto max-h-96">
            {queue.length === 0 ? (
              <p className="text-white/30 text-xs text-center py-6 font-mono">Queue is empty</p>
            ) : queue.map((t, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-all group">
                <span className="text-white/20 text-xs font-mono w-4 flex-shrink-0">{i + 1}</span>
                {t.album_image
                  ? <img src={t.album_image} className="w-8 h-8 rounded object-cover flex-shrink-0" alt="" />
                  : <div className="w-8 h-8 rounded bg-white/10 flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{t.name}</p>
                  <p className="text-white/40 text-[10px] truncate">{(t.artists || []).join(', ')}</p>
                </div>
                <span className="text-white/20 text-[10px] font-mono flex-shrink-0">{fmtMs(t.duration_ms)}</span>
                {t.spotify_url && (
                  <a href={t.spotify_url} target="_blank" rel="noopener noreferrer"
                    className="text-white/20 hover:text-spotify-green text-xs opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    title="Open in Spotify">↗</a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main player bar */}
      <div className={clsx(
        'fixed bottom-0 left-0 right-0 z-50 bg-black/95 border-t border-white/5 backdrop-blur-md transition-all duration-300',
        collapsed ? 'h-14' : 'h-[72px]'
      )}>
        <div className="max-w-screen-xl mx-auto h-full px-4 flex items-center gap-4">

          {/* Track info */}
          <div className="flex items-center gap-3 w-64 flex-shrink-0 min-w-0">
            <div className="relative flex-shrink-0">
              {item.album.image
                ? <img src={item.album.image} alt=""
                    className={clsx('rounded object-cover transition-all', collapsed ? 'w-8 h-8' : 'w-12 h-12')} />
                : <div className={clsx('rounded bg-white/10', collapsed ? 'w-8 h-8' : 'w-12 h-12')} />
              }
              {is_playing && !collapsed && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-spotify-green rounded-full flex items-center justify-center">
                  <span className="text-black text-[8px]">▶</span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-white text-sm font-medium truncate leading-tight">{item.name}</p>
                {item.spotify_url && (
                  <a href={item.spotify_url} target="_blank" rel="noopener noreferrer"
                    className="text-white/20 hover:text-spotify-green transition-colors flex-shrink-0 text-xs" title="Open in Spotify">
                    ↗
                  </a>
                )}
              </div>
              <p className="text-white/40 text-xs truncate">
                {item.artists.map(a => a.name).join(', ')}
              </p>
            </div>
          </div>

          {/* Center: controls + progress */}
          {!collapsed && (
            <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              <div className="flex items-center gap-3">
                {/* Shuffle */}
                <button onClick={handleShuffle}
                  className={clsx('text-sm transition-colors', shuffle_state ? 'text-spotify-green' : 'text-white/40 hover:text-white')}
                  title="Shuffle">
                  ⇄
                </button>
                {/* Prev */}
                <button onClick={handlePrev}
                  className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-colors text-lg"
                  title="Previous">
                  ⏮
                </button>
                {/* Play/Pause */}
                <button onClick={handlePlayPause}
                  className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform shadow-lg text-black text-sm"
                  title={is_playing ? 'Pause' : 'Play'}>
                  {is_playing ? '⏸' : '▶'}
                </button>
                {/* Next */}
                <button onClick={handleNext}
                  className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-colors text-lg"
                  title="Next">
                  ⏭
                </button>
                {/* Repeat */}
                <button onClick={handleRepeat}
                  className={clsx('text-sm transition-colors relative', repeat_state !== 'off' ? 'text-spotify-green' : 'text-white/40 hover:text-white')}
                  title={`Repeat: ${repeat_state}`}>
                  {repeat_state === 'track' ? '🔂' : '🔁'}
                </button>
              </div>
              <ProgressBar progress={progress} duration={item.duration_ms} onSeek={handleSeek} />
            </div>
          )}

          {/* Right: volume + queue + device + collapse */}
          <div className="flex items-center gap-3 w-56 justify-end flex-shrink-0">
            {!collapsed && (
              <>
                <VolumeControl volume={vol} onChange={handleVolume} />
                <button onClick={toggleQueue}
                  className={clsx('text-xs px-2 py-1 rounded font-mono transition-all',
                    showQueue ? 'bg-spotify-green/20 text-spotify-green' : 'text-white/30 hover:text-white hover:bg-white/5')}
                  title="View Queue">
                  ☰ Queue
                </button>
              </>
            )}
            {device?.name && (
              <div className="flex items-center gap-1.5 text-spotify-green" title={`Playing on: ${device.name}`}>
                <span className="text-xs">{device.type === 'Computer' ? '💻' : device.type === 'Smartphone' ? '📱' : '🔊'}</span>
                {!collapsed && <span className="text-[10px] font-mono truncate max-w-20">{device.name}</span>}
              </div>
            )}
            <button onClick={() => setCollapsed(c => !c)}
              className="text-white/20 hover:text-white text-xs transition-colors" title={collapsed ? 'Expand' : 'Collapse'}>
              {collapsed ? '▲' : '▼'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
