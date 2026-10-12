import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

type Request = { id: string; kind: 'school' | 'restaurant'; name: string; domain: string | null; contact_email: string; contact_name: string | null; phone: string | null; status: string; created_at: string }
export function StudentRequests() {
  const client = useQueryClient()
  const requests = useQuery({ queryKey: ['student-requests'], queryFn: async () => {
    const { data, error } = await supabase.from('kouponly_student_requests').select('*').order('created_at', { ascending: false }).limit(100)
    if (error) throw error
    return data as Request[]
  } })
  const status = useMutation({ mutationFn: async ({ id, value }: { id: string; value: string }) => {
    const { data, error } = await supabase.from('kouponly_student_requests').update({ status: value }).eq('id', id).select('id').single()
    if (error || !data) throw error || new Error('Request could not be updated.')
  }, onSuccess: () => client.invalidateQueries({ queryKey: ['student-requests'] }) })
  return <section className="space-y-4 rounded-2xl border bg-card p-5">
    <div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Student requests</h2><p className="text-sm text-muted-foreground">Latest 100 school suggestions and restaurant requests.</p></div><Button variant="outline" onClick={() => void requests.refetch()}>Refresh</Button></div>
    {requests.isPending ? <p>Loading requests…</p> : requests.error ? <p role="alert">Unable to load requests: {requests.error.message}</p> : !requests.data?.length ? <p>No requests yet.</p> : requests.data.map(request => <div key={request.id} className="flex flex-wrap items-start justify-between gap-4 border-t pt-4">
      <div><p className="font-medium">{request.name} · {request.kind === 'school' ? 'School domain' : 'Restaurant'}</p>{request.domain ? <p>{request.domain}</p> : null}<p className="text-sm text-muted-foreground">{request.contact_email}{request.contact_name ? ` · ${request.contact_name}` : ''}{request.phone ? ` · ${request.phone}` : ''}</p><p className="text-xs text-muted-foreground">{new Date(request.created_at).toLocaleDateString()}</p></div>
      <select aria-label={`Status for ${request.name}`} className="rounded-lg border bg-background p-2" value={request.status} disabled={status.isPending} onChange={e => status.mutate({ id: request.id, value: e.target.value })}>{['pending', 'reviewed', 'completed', 'declined'].map(value => <option key={value} value={value}>{value}</option>)}</select>
    </div>)}
    {status.error ? <p role="alert" className="text-destructive">Unable to save status: {status.error.message}</p> : null}
  </section>
}
