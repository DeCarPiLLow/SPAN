import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import { generatePKCE } from '../utils/pkce'
import { initiateLogin } from '../api/auth'

export default function Login() {
  const { accessToken } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (accessToken) navigate('/app')
  }, [accessToken, navigate])

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const { verifier, challenge } = await generatePKCE()
      const res = await initiateLogin(challenge, verifier)
      window.location.href = res.data.auth_url
    } catch (e) {
      setError('Failed to initiate login. Is the backend running?')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-spotify-black flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(#1DB954 1px, transparent 1px), linear-gradient(90deg, #1DB954 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-spotify-green/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-spotify-green/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-10 text-center px-6 max-w-md w-full animate-fade-in">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-spotify-green/10 border border-spotify-green/20 flex items-center justify-center animate-pulse-glow">
            <span className="text-spotify-green text-4xl font-display">◈</span>
          </div>
          <div>
            <h1 className="font-display text-4xl font-bold text-white tracking-tight">
              Spotify <span className="text-spotify-green">Analyzer</span>
            </h1>
            <p className="text-white/40 mt-2 text-sm leading-relaxed">
              Deep analytics for your listening habits.<br />
              Mood radars, genre evolution, global comparisons.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {['Mood Radar', 'Genre Evolution', 'Listening Clock', 'AI Persona', 'Global Compare', 'Taste Twin'].map(f => (
            <span key={f} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/50 text-xs font-mono">{f}</span>
          ))}
        </div>

        <div className="w-full space-y-3">
          <button onClick={handleLogin} disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-spotify-green hover:bg-green-400 disabled:opacity-50 disabled:cursor-wait text-black font-display font-bold text-base py-4 px-8 rounded-xl transition-all duration-200 shadow-lg shadow-spotify-green/20">
            {loading
              ? <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              : <span className="text-lg">♪</span>}
            {loading ? 'Connecting...' : 'Connect with Spotify'}
          </button>
          {error && <p className="text-red-400/80 text-xs font-mono text-center">{error}</p>}
          <p className="text-white/20 text-xs text-center">Uses Spotify OAuth 2.0 PKCE — we never store your password.</p>
        </div>
      </div>
      <div className="absolute bottom-6 text-white/15 text-xs font-mono">spotify-analyzer · built on Spotify Web API</div>
    </div>
  )
}
