import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import { exchangeCallback } from '../api/auth'

export default function Callback() {
  const navigate          = useNavigate()
  const { setTokens, setUser } = useAuthStore()
  const [status, setStatus]   = useState('Completing authentication...')
  const [error, setError]     = useState('')
  const ran = useRef(false)  // prevent React StrictMode double-fire

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const params   = new URLSearchParams(window.location.search)
    const code     = params.get('code')
    const state    = params.get('state')
    const errParam = params.get('error')

    if (errParam) {
      setError(`Spotify denied access: ${errParam}`)
      return
    }
    if (!code || !state) {
      setError('Missing code or state from Spotify callback.')
      return
    }

    // PKCE verifier is stored server-side (Redis); no sessionStorage required (localhost vs 127.0.0.1 safe).

    const run = async () => {
      try {
        setStatus('Exchanging tokens with Spotify...')
        const res = await exchangeCallback(code, state)
        setTokens(res.data.access_token, res.data.refresh_token)
        setUser(res.data.user)
        setStatus('Redirecting...')
        navigate('/app', { replace: true })
      } catch (e) {
        const msg = e.response?.data?.error || e.message || 'Authentication failed.'
        setError(msg)
      }
    }
    run()
  }, [])

  return (
    <div className="min-h-screen bg-spotify-black flex flex-col items-center justify-center gap-6 px-4">
      {error ? (
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <span className="text-red-400 text-xl">✕</span>
          </div>
          <p className="text-red-400 font-mono text-sm leading-relaxed">{error}</p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="px-5 py-2.5 bg-spotify-green/10 hover:bg-spotify-green/20 text-spotify-green rounded-lg text-sm font-mono transition-all"
          >
            ← Return to Login
          </button>
        </div>
      ) : (
        <>
          <div className="w-14 h-14 rounded-2xl bg-spotify-green/10 border border-spotify-green/20 flex items-center justify-center animate-pulse-glow">
            <span className="text-spotify-green text-3xl">◈</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-spotify-green/30 border-t-spotify-green rounded-full animate-spin" />
            <p className="text-white/50 font-mono text-sm">{status}</p>
          </div>
        </>
      )}
    </div>
  )
}
