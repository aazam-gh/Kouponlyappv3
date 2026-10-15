import { useState } from 'react'
import { IconTicket } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

type Receipt = { billAmount?: number | null; currency?: string; id: string; userId: string; vendorId: string; offerId: string; email: string; vendor: string; offer: string; code: string; consumedAt: string; status: string; roundId: string; periodId: string }
type Activity = { total: number; allTime: number; thisMonth: number; uniqueUsers: number; receipts: Receipt[]; vendors: { vendorId: string; vendor: string; count: number; thisMonth: number; uniqueUsers: number }[]; daily: { day: string; count: number }[] }
const vendorChartConfig = {
 allTime: { label: 'All time', color: '#18B852' },
 thisMonth: { label: 'This month', color: '#B7F52B' },
} satisfies ChartConfig
const dailyChartConfig = { count: { label: 'Redemptions', color: '#18B852' } } satisfies ChartConfig
export function CouponActivity({ vendorId, userId, overview = false }: { vendorId?: string; userId?: string; overview?: boolean }) {
 const [search, setSearch] = useState('')
 const [page, setPage] = useState(0)
 const query = useQuery({ queryKey: ['admin-coupons', vendorId, userId, search, page], queryFn: async () => {
  const { data, error } = await supabase.rpc('kouponly_admin_coupons', { p_vendor_id: vendorId ?? null, p_user_id: userId ?? null, p_search: search, p_offset: page * 25, p_limit: 25 })
  if (error) throw error
  return data as Activity
 }, refetchInterval: 30000 })
 const data = query.data
 return <div className="mx-auto w-full max-w-[1440px] space-y-7 p-4 sm:p-7 lg:p-9">
  <div className="flex flex-wrap items-end justify-between gap-4">
   <div><h1 className="text-3xl font-semibold tracking-tight">{overview ? (vendorId ? 'Vendor coupon activity' : 'Coupon performance') : 'Consumed coupons'}</h1><p className="mt-1.5 text-sm text-muted-foreground">Free in-store coupons · monthly periods use India time.</p></div>
   <Button variant="outline" className="bg-white" onClick={() => void query.refetch()} disabled={query.isFetching}>{query.isFetching ? 'Refreshing…' : 'Refresh'}</Button>
  </div>
  {query.isError ? <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">Could not load coupon activity: {query.error.message}</div> : query.isPending ? <p className="text-sm text-muted-foreground">Loading coupon activity…</p> : <>
   <div className="grid gap-3 lg:grid-cols-[1.15fr_1fr_1fr]">
    <div className="relative overflow-hidden rounded-2xl bg-[#B7F52B] p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[#27350D]">Coupons redeemed</p><p className="mt-1 text-xs text-[#394B18]">This month</p></div><span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-black/10"><IconTicket className="size-5" /></span></div><p className="mt-4 text-5xl font-semibold tracking-tight tabular-nums text-[#11170A]">{data!.thisMonth.toLocaleString('en-IN')}</p><p className="mt-2 text-xs text-[#394B18]">Free in-store coupons used across vendors</p></div>
    <div className="rounded-2xl border border-border/80 bg-white p-5 shadow-[0_1px_2px_rgba(20,35,24,0.04)] sm:p-6"><p className="text-sm font-medium text-muted-foreground">All-time consumed</p><p className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">{data!.allTime.toLocaleString('en-IN')}</p><p className="mt-2 text-xs text-muted-foreground">Total coupons used</p></div>
    <div className="rounded-2xl border border-border/80 bg-white p-5 shadow-[0_1px_2px_rgba(20,35,24,0.04)] sm:p-6"><p className="text-sm font-medium text-muted-foreground">Unique redeemers</p><p className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">{data!.uniqueUsers.toLocaleString('en-IN')}</p><p className="mt-2 text-xs text-muted-foreground">Students who have redeemed</p></div>
   </div>
   {overview && <>
    <div className="grid gap-4 xl:grid-cols-2">
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-white p-5 shadow-[0_1px_2px_rgba(20,35,24,0.04)] sm:p-6">
     <div className="mb-4"><h2 className="font-semibold">Coupon use by vendor</h2><p className="mt-1 text-sm text-muted-foreground">Monthly use compared with each vendor’s all-time total</p></div>
     {data!.vendors.length ? <ChartContainer config={vendorChartConfig} className="aspect-auto w-full" style={{ height: Math.max(260, data!.vendors.length * 26) }}>
      <BarChart accessibilityLayer data={data!.vendors.map(v => ({ vendor: v.vendor, allTime: v.count, thisMonth: v.thisMonth }))} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
       <CartesianGrid horizontal={false} />
       <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
       <YAxis type="category" dataKey="vendor" width={112} tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11 }} />
       <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
       <ChartLegend content={<ChartLegendContent />} />
       <Bar dataKey="allTime" name="All time" fill="var(--color-allTime)" radius={[0, 4, 4, 0]} maxBarSize={16} />
       <Bar dataKey="thisMonth" name="This month" fill="var(--color-thisMonth)" radius={[0, 4, 4, 0]} maxBarSize={16} />
      </BarChart>
     </ChartContainer> : <p className="rounded-xl bg-[#F5F7F4] px-4 py-8 text-center text-sm text-muted-foreground">No vendor coupon activity yet.</p>}
    </section>
    <section className="rounded-2xl border border-border/80 bg-white p-5 shadow-[0_1px_2px_rgba(20,35,24,0.04)] sm:p-6">
     <div className="mb-4"><h2 className="font-semibold">Daily redemptions</h2><p className="mt-1 text-sm text-muted-foreground">Active dates this month · India time</p></div>
     {data!.daily.length ? <ChartContainer config={dailyChartConfig} className="aspect-auto h-[320px] w-full">
      <BarChart accessibilityLayer data={data!.daily.map(d => ({ day: new Date(`${d.day}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), count: d.count }))} margin={{ left: -20, right: 8, top: 8, bottom: 4 }}>
       <CartesianGrid vertical={false} />
       <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={20} />
       <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
       <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
       <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
     </ChartContainer> : <p className="rounded-xl bg-[#F5F7F4] px-4 py-8 text-center text-sm text-muted-foreground">No coupons consumed this month.</p>}
    </section>
    </div>
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-white shadow-[0_1px_2px_rgba(20,35,24,0.04)]">
     <div className="border-b border-border/70 px-5 py-4 sm:px-6"><h2 className="font-semibold">Vendor activity details</h2><p className="mt-1 text-sm text-muted-foreground">Top 20 vendors by all-time coupon use</p></div>
     <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-[#F8FAF7]"><TableHead>Vendor</TableHead><TableHead>This month</TableHead><TableHead>All-time consumed</TableHead><TableHead>Unique redeemers</TableHead></TableRow></TableHeader><TableBody>{data!.vendors.map(v => <TableRow key={v.vendorId + v.vendor}><TableCell><Link className="font-medium text-foreground underline-offset-4 hover:text-[#128A43] hover:underline" to="/admin/vendors/$vendorId/settings/invoices" params={{vendorId:v.vendorId}} search={{page:1,pageSize:10}}>{v.vendor}</Link></TableCell><TableCell className="tabular-nums">{v.thisMonth}</TableCell><TableCell className="tabular-nums">{v.count}</TableCell><TableCell className="tabular-nums">{v.uniqueUsers}</TableCell></TableRow>)}{!data!.vendors.length && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No vendor coupon activity yet.</TableCell></TableRow>}</TableBody></Table></div>
    </section>
   </>}
  </>}
  <section className="overflow-hidden rounded-2xl border border-border/80 bg-white shadow-[0_1px_2px_rgba(20,35,24,0.04)]">
   <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4 sm:px-6"><div><h2 className="font-semibold">Recent receipts</h2><p className="mt-1 text-sm text-muted-foreground">Search by vendor, offer, student, receipt ID or code</p></div><Input className="w-full bg-white sm:max-w-sm" aria-label="Search consumed coupons" placeholder="Search receipts" maxLength={200} value={search} onChange={e => {setSearch(e.target.value); setPage(0)}} /></div>
   <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-[#F8FAF7]">{['Consumed (India time)', 'User', 'Vendor / offer', 'Unique confirmation code', 'Bill total before discount', 'Status / receipt'].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{data?.receipts.map(r => <TableRow key={r.id}><TableCell className="whitespace-nowrap text-muted-foreground">{new Date(r.consumedAt).toLocaleString('en-IN', {timeZone:'Asia/Kolkata'})}</TableCell><TableCell><Link className="font-medium text-foreground underline-offset-4 hover:text-[#128A43] hover:underline" to="/admin/students/$studentId/settings" params={{studentId:r.userId}} search={{page:1,pageSize:10,search:''}}>{r.email || r.userId}</Link></TableCell><TableCell><Link className="font-medium text-foreground underline-offset-4 hover:text-[#128A43] hover:underline" to="/admin/vendors/$vendorId/settings/invoices" params={{vendorId:r.vendorId}} search={{page:1,pageSize:10}}>{r.vendor}</Link><p className="mt-1 text-xs text-muted-foreground">{r.offer}</p></TableCell><TableCell className="select-all font-mono text-xs">{r.code}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{r.billAmount == null ? '—' : `${r.currency ?? ''} ${Number(r.billAmount).toFixed(2)}`}</TableCell><TableCell><span className="inline-flex rounded-full bg-[#E8F6EC] px-2.5 py-1 text-xs font-medium text-[#176C38]">{r.status}</span><details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer py-1">Receipt details</summary><p className="break-all pt-1">ID: {r.id}</p><p className="break-all">Offer: {r.offerId}</p><p className="break-all">Month period: {r.periodId}</p><p className="break-all">Coupon round: {r.roundId}</p></details></TableCell></TableRow>)}{data && !data.receipts.length && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No consumed coupons found.</TableCell></TableRow>}</TableBody></Table></div>
   <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-5 py-4 sm:px-6"><span className="text-sm text-muted-foreground">Page {page+1} · {data?.total ?? '…'} matching receipts</span><div className="flex items-center gap-2"><Button variant="outline" disabled={page===0 || query.isFetching} onClick={() => setPage(page-1)}>Previous</Button><Button variant="outline" disabled={!data || (page+1)*25>=data.total || query.isFetching} onClick={() => setPage(page+1)}>Next</Button></div></div>
  </section>
 </div>
}
