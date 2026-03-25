import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import useAuthStore from '../../store/authStore'
import { logout as logoutApi } from '../../api/auth'
import { syncData } from '../../api/personal'
import { getMe } from '../../api/auth'
import NowPlaying from '../ui/NowPlaying'
import clsx from 'clsx'

const NAV = [
  { label: 'Dashboard',        path: '/app',                  icon: '⬡', end: true },
  { section: 'Personal' },
  { label: 'Listening Clock',  path: '/app/listening-clock',  icon: '◷' },
  { label: 'Mood Radar',       path: '/app/mood-radar',       icon: '◈' },
  { label: 'Genre Evolution',  path: '/app/genre-evolution',  icon: '▦' },
  { label: 'Discovery Ratio',  path: '/app/discovery',        icon: '◎' },
  { label: 'My Persona',       path: '/app/persona',          icon: '◉' },
  { label: 'Top Tracks',       path: '/app/top-tracks',       icon: '♪' },
  { label: 'Decade Breakdown', path: '/app/decade',           icon: '⧖' },
  { label: 'BPM Evolution',    path: '/app/bpm',              icon: '∿' },
  { label: 'History',           path: '/app/history',           icon: '◑' },
  { section: 'Global' },
  { label: 'Mood Meter',       path: '/app/global-mood',      icon: '◌' },
  { label: 'Artist Velocity',  path: '/app/artist-velocity',  icon: '↑' },
  { label: 'Shelf Life',       path: '/app/shelf-life',       icon: '⧗' },
  { section: 'Compare' },
  { label: 'Mainstream Score', path: '/app/mainstream',       icon: '⊕' },
  { label: 'Taste Twin',       path: '/app/taste-twin',       icon: '≈' },
  { label: 'Mood Delta',       path: '/app/mood-delta',       icon: '△' },
  { section: 'Engage' },
  { label: 'My Receipt',       path: '/app/receipt',          icon: '◻' },
  { label: 'Compatibility',    path: '/app/compatibility',    icon: '♡' },
]

export default function Layout() {
  const { user, logout, setUser, accessToken } = useAuthStore()
  const navigate = useNavigate()
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [open, setOpen]       = useState(true)

  // Refresh-safe: reload user profile on page reload using persisted JWT.
  useEffect(() => {
    if (!accessToken) return
    if (user) return
    getMe().then(r => setUser(r.data)).catch(() => {
      logout()
      navigate('/', { replace: true })
    })
  }, [accessToken, user, logout, setUser, navigate])

  const handleLogout = async () => {
    try { await logoutApi() } catch {}
    logout()
    navigate('/')
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await syncData()
      setSyncMsg(`✓ Synced ${res.data.synced_recently_played + res.data.synced_top_tracks} tracks`)
      setTimeout(() => setSyncMsg(''), 4000)
    } catch (e) {
      setSyncMsg('Sync failed')
      setTimeout(() => setSyncMsg(''), 3000)
    }
    setSyncing(false)
  }

  return (
    <div className="flex h-screen bg-spotify-black overflow-hidden">
      {/* Sidebar */}
      <aside className={clsx(
        'flex flex-col bg-black border-r border-white/5 transition-all duration-300 flex-shrink-0 pb-20',
        open ? 'w-60' : 'w-16'
      )}>
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
          <span className="text-spotify-green text-2xl flex-shrink-0 font-display">◈</span>
          {open && <span className="font-display font-bold text-white text-sm tracking-widest uppercase">Analyzer</span>}
          <button onClick={() => setOpen(!open)}
            className="ml-auto text-white/30 hover:text-white/70 text-xs transition-colors">
            {open ? '◂' : '▸'}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV.map((item, i) => {
            if (item.section) return open
              ? <p key={i} className="text-white/25 text-[10px] font-mono uppercase tracking-widest px-3 pt-4 pb-1">{item.section}</p>
              : <div key={i} className="my-2 border-t border-white/5" />
            return (
              <NavLink key={item.path} to={item.path} end={item.end}
                className={({ isActive }) => clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                  isActive ? 'bg-spotify-green/10 text-spotify-green font-medium' : 'text-white/50 hover:text-white hover:bg-white/5'
                )}
                title={!open ? item.label : undefined}
              >
                <span className="text-base flex-shrink-0 w-5 text-center">{item.icon}</span>
                {open && <span className="truncate">{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-white/5 p-3 space-y-2">
          <button onClick={handleSync} disabled={syncing}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-all',
              syncing ? 'bg-spotify-green/20 text-spotify-green cursor-wait' : 'bg-spotify-green/10 hover:bg-spotify-green/20 text-spotify-green'
            )}>
            <span className={syncing ? 'animate-spin inline-block' : ''}>↻</span>
            {open && (syncing ? 'Syncing...' : 'Sync Data')}
          </button>

          {open && syncMsg && (
            <p className="text-spotify-green/70 text-[10px] font-mono px-3 text-center">{syncMsg}</p>
          )}

          {open && user && (
            <div className="flex items-center gap-2 px-2 py-1">
              {user.avatar_url
                ? <img src={user.avatar_url} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
                : <div className="w-7 h-7 rounded-full bg-spotify-green/20 flex items-center justify-center text-spotify-green text-xs flex-shrink-0">
                    {(user.display_name || 'U')[0]}
                  </div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">{user.display_name}</p>
                <p className="text-white/30 text-[10px] capitalize">{user.product}</p>
              </div>
            </div>
          )}

          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <span>⎋</span>
            {open && 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main content — pb-20 so player bar never overlaps content */}
      <main className="flex-1 overflow-y-auto bg-spotify-dark pb-20">
        <div className="max-w-6xl mx-auto p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* Persistent Now Playing bar */}
      <NowPlaying />
    </div>
  )
}