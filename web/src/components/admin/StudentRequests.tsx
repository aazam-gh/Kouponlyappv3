import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Globe2, Loader2, Mail, MapPin, Phone, RefreshCw, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

const PAGE_SIZE = 10
const statuses = ['pending', 'reviewed', 'completed', 'declined'] as const
type Request = { id: string; kind: 'school' | 'restaurant'; name: string; domain: string | null; contact_email: string; contact_name: string | null; phone: string | null; location: string | null; status: typeof statuses[number]; created_at: string }

export function StudentRequests() {
  const client = useQueryClient()
  const [page, setPage] = useState(0)
  const requests = useQuery({
    queryKey: ['student-requests', page],
    queryFn: async () => {
      const from = page * PAGE_SIZE
      const { data, count, error } = await supabase.from('kouponly_student_requests')
        .select('id,kind,name,domain,contact_email,contact_name,phone,location,status,created_at', { count: 'exact' })
        .order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      return { items: (data ?? []) as Request[], total: count ?? 0 }
    },
  })
  const refresh = () => client.invalidateQueries({ queryKey: ['student-requests'] })
  const status = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: Request['status'] }) => {
      const { data, error } = await supabase.from('kouponly_student_requests').update({ status: value }).eq('id', id).select('id').single()
      if (error || !data) throw error || new Error('Request could not be updated.')
    },
    onSuccess: () => { toast.success('Request status updated'); void refresh() },
    onError: error => toast.error(error instanceof Error ? error.message : 'Could not update request'),
  })
  const remove = useMutation({
    mutationFn: async (request: Request) => {
      if (!window.confirm(`Delete the ${request.kind} request “${request.name}”? This cannot be undone.`)) return false
      const { data, error } = await supabase.from('kouponly_student_requests').delete().eq('id', request.id).select('id').single()
      if (error || !data) throw error || new Error('Request could not be deleted.')
      return true
    },
    onSuccess: deleted => {
      if (!deleted) return
      if (requests.data?.items.length === 1 && page > 0) setPage(current => current - 1)
      toast.success('Request deleted')
      void refresh()
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Could not delete request'),
  })

  const items = requests.data?.items ?? []
  const total = requests.data?.total ?? 0
  const pageCount = Math.ceil(total / PAGE_SIZE)
  const rangeStart = total ? page * PAGE_SIZE + 1 : 0
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total)

  return <section className="space-y-5 rounded-2xl border bg-card p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Student requests</h2><p className="mt-1 text-sm text-muted-foreground">Review school and restaurant suggestions.</p></div>
      <Button variant="outline" disabled={requests.isFetching} onClick={() => void requests.refetch()}><RefreshCw className={`size-4 ${requests.isFetching ? 'animate-spin' : ''}`} />Refresh</Button>
    </div>

    {requests.isPending ? <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Loading requests…</p>
      : requests.error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Unable to load requests: {requests.error.message}</p>
        : !items.length ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No requests on this page.</p>
          : <div className="grid gap-3">
            {items.map(request => <article key={request.id} className="flex flex-col gap-4 rounded-xl border bg-background p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{request.kind === 'school' ? 'School suggestion' : 'Restaurant suggestion'}</Badge><h3 className="font-semibold">{request.name}</h3></div>
                <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <p className="flex min-w-0 items-center gap-2"><Mail className="size-4 shrink-0 text-muted-foreground" /><span className="truncate">{request.contact_email}</span></p>
                  {request.contact_name ? <p className="flex min-w-0 items-center gap-2"><UserRound className="size-4 shrink-0 text-muted-foreground" /><span className="truncate">{request.contact_name}</span></p> : null}
                  {request.domain ? <p className="flex min-w-0 items-center gap-2"><Globe2 className="size-4 shrink-0 text-muted-foreground" /><span className="truncate">{request.domain}</span></p> : null}
                  {request.location ? <p className="flex min-w-0 items-center gap-2"><MapPin className="size-4 shrink-0 text-muted-foreground" /><span className="truncate">{request.location}</span></p> : null}
                  {request.phone ? <p className="flex min-w-0 items-center gap-2"><Phone className="size-4 shrink-0 text-muted-foreground" /><span>{request.phone}</span></p> : null}
                  <p className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="size-4 shrink-0" /><span>{new Date(request.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span></p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                <label className="sr-only" htmlFor={`request-status-${request.id}`}>Status for {request.name}</label>
                <select id={`request-status-${request.id}`} className="h-9 rounded-md border bg-background px-3 text-sm capitalize" value={request.status} disabled={status.isPending || remove.isPending} onChange={event => status.mutate({ id: request.id, value: event.target.value as Request['status'] })}>
                  {statuses.map(value => <option key={value} value={value} className="capitalize">{value}</option>)}
                </select>
                <Button type="button" variant="outline" size="icon" className="text-destructive hover:text-destructive" aria-label={`Delete ${request.name} request`} title="Delete request" disabled={status.isPending || remove.isPending} onClick={() => remove.mutate(request)}>
                  {remove.isPending && remove.variables?.id === request.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                </Button>
              </div>
            </article>)}
          </div>}

    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <p className="text-sm text-muted-foreground">Showing {rangeStart}–{rangeEnd} of {total} requests</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 0 || requests.isFetching} onClick={() => setPage(current => current - 1)}>Previous</Button>
        <Button variant="outline" size="sm" disabled={page + 1 >= pageCount || requests.isFetching} onClick={() => setPage(current => current + 1)}>Next</Button>
      </div>
    </div>
  </section>
}
