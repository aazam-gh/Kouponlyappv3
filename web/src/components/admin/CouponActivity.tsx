import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Receipt = { id: string; userId: string; vendorId: string; offerId: string; email: string; vendor: string; offer: string; code: string; consumedAt: string; status: string; roundId: string; periodId: string }
type Activity = { total: number; allTime: number; thisMonth: number; uniqueUsers: number; receipts: Receipt[]; vendors: { vendorId: string; vendor: string; count: number; thisMonth: number; uniqueUsers: number }[]; daily: { day: string; count: number }[] }
export function CouponActivity({ vendorId, userId, overview = false }: { vendorId?: string; userId?: string; overview?: boolean }) {
 const [search, setSearch] = useState('')
 const [page, setPage] = useState(0)
 const query = useQuery({ queryKey: ['admin-coupons', vendorId, userId, search, page], queryFn: async () => {
  const { data, error } = await supabase.rpc('kouponly_admin_coupons', { p_vendor_id: vendorId ?? null, p_user_id: userId ?? null, p_search: search, p_offset: page * 25, p_limit: 25 })
  if (error) throw error
  return data as Activity
 }, refetchInterval: 30000 })
 const data = query.data
 return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-8">
  <div className="flex items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold">{overview ? (vendorId ? 'Vendor coupon activity' : 'Overview') : 'Consumed coupons'}</h1><p className="text-sm text-muted-foreground">Free in-store coupons · monthly periods use India time.</p></div><Button variant="outline" onClick={() => void query.refetch()}>Refresh</Button></div>
  {query.isError ? <div role="alert">Could not load coupon activity: {query.error.message}</div> : query.isPending ? <p>Loading coupon activity…</p> : <>
  <div className="grid gap-4 sm:grid-cols-3">{[['Consumed this month', data!.thisMonth], ['All-time consumed', data!.allTime], ['Unique redeemers', data!.uniqueUsers]].map(([label, value]) => <div key={label} className="rounded-2xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="text-3xl font-semibold">{value}</p></div>)}</div>
  {overview && <><h2 className="text-lg font-semibold">Vendor activity · top 20 by all-time consumption</h2><Table><TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead>This month</TableHead><TableHead>All-time consumed</TableHead><TableHead>Unique redeemers</TableHead></TableRow></TableHeader><TableBody>{data!.vendors.map(v => <TableRow key={v.vendorId + v.vendor}><TableCell><Link to="/admin/vendors/$vendorId/settings/invoices" params={{ vendorId: v.vendorId }} search={{page:1,pageSize:10}}>{v.vendor}</Link></TableCell><TableCell>{v.thisMonth}</TableCell><TableCell>{v.count}</TableCell><TableCell>{v.uniqueUsers}</TableCell></TableRow>)}</TableBody></Table><h2 className="text-lg font-semibold">Daily consumption this month</h2><div className="flex flex-wrap gap-4">{data!.daily.map(d => <p key={d.day}>{d.day}: <strong>{d.count}</strong></p>)}{!data!.daily.length && <p>No coupons consumed this month.</p>}</div></>}
  </>}
  <Input aria-label="Search consumed coupons" placeholder="Search vendor, offer, email, receipt ID or code" maxLength={200} value={search} onChange={e => {setSearch(e.target.value); setPage(0)}} />
  <div className="overflow-x-auto"><Table><TableHeader><TableRow>{['Consumed (India time)', 'User', 'Vendor / offer', 'Unique confirmation code', 'Status / receipt'].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{data?.receipts.map(r => <TableRow key={r.id}><TableCell>{new Date(r.consumedAt).toLocaleString('en-IN', {timeZone:'Asia/Kolkata'})}</TableCell><TableCell><Link to="/admin/students/$studentId/settings" params={{studentId:r.userId}} search={{page:1,pageSize:10,search:''}}>{r.email || r.userId}</Link></TableCell><TableCell><Link to="/admin/vendors/$vendorId/settings/invoices" params={{vendorId:r.vendorId}} search={{page:1,pageSize:10}}>{r.vendor}</Link><p>{r.offer}</p></TableCell><TableCell className="font-mono break-all select-all">{r.code}</TableCell><TableCell>{r.status}<details><summary>Receipt details</summary><p className="break-all">ID: {r.id}</p><p className="break-all">Offer: {r.offerId}</p><p className="break-all">Month period: {r.periodId}</p><p className="break-all">Coupon round: {r.roundId}</p></details></TableCell></TableRow>)}{data && !data.receipts.length && <TableRow><TableCell colSpan={5}>No consumed coupons found.</TableCell></TableRow>}</TableBody></Table></div>
  <div className="flex items-center gap-4"><Button variant="outline" disabled={page===0 || query.isFetching} onClick={() => setPage(page-1)}>Previous</Button><span>Page {page+1} · {data?.total ?? '…'} matching receipts</span><Button variant="outline" disabled={!data || (page+1)*25>=data.total || query.isFetching} onClick={() => setPage(page+1)}>Next</Button></div>
 </div>
}
