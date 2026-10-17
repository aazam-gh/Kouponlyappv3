import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type VendorRequest = { id: string; vendor_id: string; requester_id: string; request_type: string; details: string; status: 'pending' | 'contacted' | 'closed'; created_at: string }
export const Route = createFileRoute('/admin/vendor-requests')({ component: VendorRequests })

function VendorRequests() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['vendor-requests'], queryFn: async () => {
    const { data, error } = await supabase.from('kouponly_vendor_support_requests').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data as VendorRequest[]
  } })
  const update = useMutation({ mutationFn: async ({ id, status }: { id: string; status: VendorRequest['status'] }) => {
    const { error } = await supabase.from('kouponly_vendor_support_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
  }, onSuccess: () => { toast.success('Request updated'); void client.invalidateQueries({ queryKey: ['vendor-requests'] }) }, onError: e => toast.error(e instanceof Error ? e.message : 'Could not update request') })
  return <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-8">
    <div className="flex items-end justify-between"><div><h1 className="text-2xl font-semibold">Vendor Requests</h1><p className="mt-1 text-sm text-muted-foreground">Staff visit, offer, and support requests from vendor accounts.</p></div><Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>Refresh</Button></div>
    {query.isError ? <p role="alert" className="text-sm text-destructive">Could not load requests: {query.error.message}</p> : query.isPending ? <p>Loading requests…</p> : <div className="divide-y rounded-xl border bg-white">
      {query.data.map(request => <article key={request.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:p-5"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold capitalize">{request.request_type.replace('_',' ')}</h2><span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">{request.status}</span></div><p className="mt-1 whitespace-pre-wrap text-sm">{request.details}</p><p className="mt-2 break-all text-xs text-muted-foreground">Vendor {request.vendor_id} · {new Date(request.created_at).toLocaleString()}</p></div><select aria-label={`Status for request ${request.id}`} className="h-10 rounded-md border bg-white px-3 text-sm" value={request.status} onChange={e => update.mutate({ id: request.id, status: e.target.value as VendorRequest['status'] })}><option value="pending">Pending</option><option value="contacted">Contacted</option><option value="closed">Closed</option></select></article>)}
      {!query.data.length && <p className="p-10 text-center text-sm text-muted-foreground">No vendor requests yet.</p>}
    </div>}
  </main>
}
