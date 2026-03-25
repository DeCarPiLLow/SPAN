import { useEffect, useState } from 'react'
import { getShelfLife } from '../../api/global'
import { PageHeader, LoadingSpinner, Card, StatCard } from '../../components/ui'

export default function ShelfLife() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getShelfLife().then(r => { setData(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner message="Calculating chart shelf life..." />

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader badge="Global" title="Shelf Life Index" subtitle="How long do songs stay in the Global Top 50 charts?" />
      {!data || data.message ? (
        <Card>
          <p className="text-white/50 text-sm">{data?.message || 'No snapshot data yet. Daily snapshots are needed to calculate shelf life.'}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Avg Days on Chart" value={data.avg_days_on_chart} sub="per track" accent />
          <StatCard label="Unique Tracks"     value={data.total_unique_tracks} sub="across all snapshots" />
          <StatCard label="Snapshots Used"    value={data.snapshots_analyzed} sub="daily snapshots analysed" />
        </div>
      )}
    </div>
  )
}
