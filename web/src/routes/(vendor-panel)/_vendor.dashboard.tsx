import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { vendorStatsQueryOptions, vendorChartDataQueryOptions, type ChartRange } from '@/queries'
import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuth } from '@/auth'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/(vendor-panel)/_vendor/dashboard')({
  component: VendorDashboard,
})

function VendorDashboard() {
  const { user } = useAuth()
  const vendorId = user?.uid || ''
  const [range, setRange] = useState<ChartRange>('7d')

  const { data: stats, isLoading: statsLoading } = useQuery(vendorStatsQueryOptions(vendorId))
  const { data: chartData, isLoading: chartLoading } = useQuery(vendorChartDataQueryOptions(vendorId, range))

  if (statsLoading || chartLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="text-2xl font-semibold">${stats?.totalRevenue || 0}</p>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">Total Redemptions</p>
          <p className="text-2xl font-semibold">{stats?.totalRedemptions || 0}</p>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">Active Offers</p>
          <p className="text-2xl font-semibold">{stats?.activeOffers || 0}</p>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">Total Discount</p>
          <p className="text-2xl font-semibold">${stats?.totalDiscount || 0}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold">Revenue Overview</h2>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as ChartRange)}
            className="border p-2 rounded"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
        <div className="h-75">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="#93c5fd" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
