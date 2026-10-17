import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useState } from 'react'

type DashboardData = {
  stats: { students: number; vendors: number; activeVendors: number; transactions: number; volume: number; redemptions: number }
  monthly: { month: string; volume: number; transactions: number; redemptions: number; students: number; vendors: number }[]
  topVendors: { id: string; name: string; redemptions: number; volume: number }[]
  topOffers: { id: string; offer: string; vendor: string; redemptions: number }[]
}

const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const monthLabel = (value: string) => new Date(`${value}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })

export function AdminDashboard() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const dashboard = useQuery({
    queryKey: ['admin-dashboard', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('kouponly_admin_dashboard', {
        p_from: from || null,
        p_to: to || null,
      })
      if (error) throw error
      return data as DashboardData
    },
  })
  const data = dashboard.data
  const selectedRange = from || to ? `${from || 'Beginning'} – ${to || 'Today'}` : 'All time'

  return <main className="mx-auto w-full max-w-[1440px] space-y-6 p-4 sm:p-7 lg:p-9">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1><p className="mt-1 text-sm text-muted-foreground">Performance for {selectedRange}</p></div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs text-muted-foreground">From<Input aria-label="Dashboard start date" type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} /></label>
        <label className="grid gap-1 text-xs text-muted-foreground">To<Input aria-label="Dashboard end date" type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} /></label>
        {(from || to) && <Button variant="outline" onClick={() => { setFrom(''); setTo('') }}>All time</Button>}
      </div>
    </div>
    {dashboard.isError ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Dashboard data could not be loaded: {dashboard.error.message}</div> : null}
    {dashboard.isPending ? <p className="text-sm text-muted-foreground">Loading dashboard…</p> : data ? <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          ['Students joined', data.stats.students.toLocaleString('en-IN')],
          ['Vendors joined', data.stats.vendors.toLocaleString('en-IN')],
          ['Active vendors', data.stats.activeVendors.toLocaleString('en-IN')],
          ['Transactions', data.stats.transactions.toLocaleString('en-IN')],
          ['Transaction volume', money(data.stats.volume)],
          ['Coupon redemptions', data.stats.redemptions.toLocaleString('en-IN')],
        ].map(([label, value]) => <Card key={label}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><p className="text-3xl font-semibold tabular-nums">{value}</p>{label === 'Transaction volume' && <p className="mt-1 text-xs text-muted-foreground">Amount paid after discounts</p>}</CardContent></Card>)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Transaction Volume" description="Completed transaction value paid after discounts, in rupees.">
          <ResponsiveContainer width="100%" height="100%"><LineChart data={data.monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tickFormatter={monthLabel} /><YAxis tickFormatter={v => `₹${Number(v).toLocaleString('en-IN')}`} /><Tooltip labelFormatter={v => monthLabel(String(v))} formatter={v => money(Number(v))} /><Line type="monotone" dataKey="volume" name="Amount paid" stroke="#18B852" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Redemption Trend" description="Coupons redeemed over the selected period.">
          <ResponsiveContainer width="100%" height="100%"><LineChart data={data.monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tickFormatter={monthLabel} /><YAxis allowDecimals={false} /><Tooltip labelFormatter={v => monthLabel(String(v))} /><Line type="monotone" dataKey="redemptions" name="Redemptions" stroke="#5595e8" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Student Growth" description="Student accounts created each month.">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={data.monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tickFormatter={monthLabel} /><YAxis allowDecimals={false} /><Tooltip labelFormatter={v => monthLabel(String(v))} /><Bar dataKey="students" name="Students joined" fill="#18B852" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Vendor Growth" description="Vendor accounts created each month.">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={data.monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tickFormatter={monthLabel} /><YAxis allowDecimals={false} /><Tooltip labelFormatter={v => monthLabel(String(v))} /><Bar dataKey="vendors" name="Vendors joined" fill="#8e70d6" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Vendor Performance</h2><p className="mb-4 mt-1 text-sm text-muted-foreground">Ranked by redemptions · {selectedRange}</p>{data.topVendors.length ? <div className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.topVendors} layout="vertical" margin={{ left: 8, right: 20 }}><CartesianGrid horizontal={false} /><XAxis type="number" /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} /><Tooltip formatter={(v, name) => name === 'Transaction volume' ? money(Number(v)) : v} /><Bar dataKey="redemptions" name="Redemptions" fill="#18B852" radius={[0,4,4,0]} /><Bar dataKey="volume" name="Transaction volume" fill="#7ab7ef" radius={[0,4,4,0]} /></BarChart></ResponsiveContainer></div> : <Empty />}</section>
        <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Most Redeemed Offers</h2><p className="mb-4 mt-1 text-sm text-muted-foreground">Highest redemption count · {selectedRange}</p>{data.topOffers.length ? <ol className="divide-y">{data.topOffers.map((offer, i) => <li key={`${offer.id}-${i}`} className="flex items-center gap-3 py-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{offer.offer || 'Unnamed offer'}</span><span className="block truncate text-xs text-muted-foreground">{offer.vendor}</span></span><span className="whitespace-nowrap text-sm tabular-nums">{offer.redemptions.toLocaleString('en-IN')}</span></li>)}</ol> : <Empty />}</section>
      </div>
    </> : null}
  </main>
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p><div className="mt-4 h-[270px]">{children}</div></section>
}

function Empty() { return <p className="rounded-lg bg-muted/50 p-8 text-center text-sm text-muted-foreground">No activity for this period.</p> }
