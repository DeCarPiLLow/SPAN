import { useEffect, useState } from 'react'
import { getTasteTwin } from '../../api/comparison'
import { PageHeader, LoadingSpinner, EmptyState, Card, StatCard } from '../../components/ui'

const COUNTRY_NAMES = {
  US: 'United States', GB: 'United Kingdom', DE: 'Germany', FR: 'France',
  BR: 'Brazil', IN: 'India', JP: 'Japan', AU: 'Australia', MX: 'Mexico', KR: 'South Korea',
}
const COUNTRY_FLAGS = {
  US: '🇺🇸', GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', BR: '🇧🇷',
  IN: '🇮🇳', JP: '🇯🇵', AU: '🇦🇺', MX: '🇲🇽', KR: '🇰🇷',
}

export default function TasteTwin() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTasteTwin().then(r => { setData(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner message="Finding your taste twin country..." />

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader badge="Compare" title="Taste Twin" subtitle="Which country's listening tastes are most similar to yours? Calculated using cosine similarity on genre vectors." />
      {!data?.country ? (
        <EmptyState icon="≈" title="Not enough data" message="We need genre snapshots for you and global chart snapshots. Run a sync and wait for the monthly snapshot task." />
      ) : (
        <>
          <Card className="flex flex-col items-center py-12 border-spotify-green/20 bg-spotify-green/5 text-center">
            <div className="text-7xl mb-4">{COUNTRY_FLAGS[data.country] || '🌍'}</div>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-2">Your taste twin is</p>
            <h2 className="font-display text-4xl font-bold text-white">{COUNTRY_NAMES[data.country] || data.country}</h2>
            <p className="text-spotify-green font-mono text-lg mt-2">{(data.similarity * 100).toFixed(1)}% similarity</p>
            <p className="text-white/40 text-sm mt-4 max-w-xs">
              Based on genre vector cosine similarity between your listening profile and each country's Top 50 chart.
            </p>
          </Card>
          <Card>
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-3">How it works</p>
            <p className="text-white/50 text-sm leading-relaxed">
              We build a genre frequency vector from your top artists and compare it to the genre distribution of each country's Top 50 playlist using cosine similarity. 
              A similarity of 1.0 would mean identical genre distributions. 
              The country with the highest similarity score is your Taste Twin.
            </p>
          </Card>
        </>
      )}
    </div>
  )
}
