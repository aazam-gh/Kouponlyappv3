import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { vendorStatsQueryOptions, vendorChartDataQueryOptions, type ChartRange } from '@/queries'
import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuth } from '@/auth'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/(vendor-panel)/_vendor/dashboard')({
  beforeLoad: ({ context }) => {
    if (context.auth.isAdmin) throw redirect({ to: '/admin/dashboard' })
  },
  component: VendorDashboard,
})

function VendorDashboard() {
  const { user } = useAuth()
  const vendorId = user?.uid || ''
  const [range, setRange] = useState<ChartRange>('7d')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const statsQuery = useQuery(vendorStatsQueryOptions(vendorId))
  const chartQuery = useQuery(vendorChartDataQueryOptions(vendorId, range, from, to))
  const { data: stats, isLoading: statsLoading } = statsQuery
  const { data: chartData, isLoading: chartLoading } = chartQuery

  if (statsLoading || chartLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>
  }

  if (statsQuery.isError || chartQuery.isError) {
    return (
      <div role="alert" className="m-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        <p className="m-0 font-semibold">Dashboard data could not be loaded.</p>
        <button className="mt-3 underline" onClick={() => void Promise.all([statsQuery.refetch(), chartQuery.refetch()])}>Try again</button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 bg-white rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">Transaction volume</p>
          <p className="text-2xl font-semibold">₹{Number(stats?.totalRevenue || 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">Total Redemptions</p>
          <p className="text-2xl font-semibold">{stats?.totalRedemptions || 0}</p>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">This month</p>
          <p className="text-2xl font-semibold">{stats?.thisMonthRedemptions || 0}</p>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">Active Offers</p>
          <p className="text-2xl font-semibold">{stats?.activeOffers || 0}</p>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">Unique customers</p>
          <p className="text-2xl font-semibold">{stats?.uniqueCustomers || 0}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <div className="flex justify-between items-center mb-6">
          <div><h2 className="text-lg font-semibold">Transaction volume</h2><p className="text-xs text-gray-500">Amount paid after discounts · ₹</p></div>
          <div className="flex flex-wrap gap-2">
          <label className="grid gap-1 text-xs text-gray-500">From<input type="date" aria-label="Vendor dashboard start date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className="rounded-md border px-2 py-1" /></label>
          <label className="grid gap-1 text-xs text-gray-500">To<input type="date" aria-label="Vendor dashboard end date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className="rounded-md border px-2 py-1" /></label>
          {(!from && !to) ? <select
            value={range}
            onChange={(e) => setRange(e.target.value as ChartRange)}
            className="border p-2 rounded"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select> : <button type="button" className="self-end text-sm underline" onClick={() => {setFrom('');setTo('')}}>Clear dates</button>}
          </div>
        </div>
        <div className="h-75">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} />
              <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Amount paid']} />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#93c5fd" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
