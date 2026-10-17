import { useEffect, useState } from 'react'
import { getCmsClickMetrics } from '@/lib/cms-clicks'

export function CmsClickSummary({ documentId, itemId }: { documentId: string; itemId: string }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [counts, setCounts] = useState<{ total_clicks: number; unique_students: number }>()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void getCmsClickMetrics(documentId, itemId, from, to).then(value => {
      if (active) { setCounts(value); setError('') }
    }).catch(reason => { if (active) setError(typeof reason?.message === 'string' ? reason.message : 'Metrics could not be loaded') })
    return () => { active = false }
  }, [documentId, itemId, from, to])

  return <div className="space-y-2 rounded-xl border bg-muted/20 p-4" aria-label="Click engagement">
    <p className="text-sm font-semibold">Engagement</p>
    <div className="flex flex-wrap gap-3 text-sm">
      <span>Total clicks: <strong>{counts?.total_clicks ?? '—'}</strong></span>
      <span>Unique students: <strong>{counts?.unique_students ?? '—'}</strong></span>
    </div>
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <label>From <input aria-label="Engagement from date" type="date" value={from} onChange={event => setFrom(event.target.value)} className="rounded border bg-background px-2 py-1" /></label>
      <label>To <input aria-label="Engagement to date" type="date" value={to} onChange={event => setTo(event.target.value)} className="rounded border bg-background px-2 py-1" /></label>
      {(from || to) && <button type="button" onClick={() => { setFrom(''); setTo('') }} className="underline">All time</button>}
      {error && <span role="status">Metrics unavailable: {error}</span>}
    </div>
  </div>
}
