import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  getHoldingDashboard,
  type HoldingRange,
} from '@/lib/holding-groups'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const Route = createFileRoute('/holding/dashboard')({
  component: HoldingDashboard,
})

function formatCurrency(value: number) {
  return `QAR ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function HoldingDashboard() {
  const [range, setRange] = useState<HoldingRange>('7d')
  const { data, isLoading, error } = useQuery({
    queryKey: ['holding-dashboard', range],
    queryFn: () => getHoldingDashboard(range),
  })

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>
  }

  if (error) {
    return <div className="p-8 text-destructive">Failed to load holding dashboard: {error.message}</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{data?.groupName || 'Holding Dashboard'}</h1>
          <p className="text-muted-foreground">Combined performance across assigned vendors.</p>
        </div>
        <Select value={range} onValueChange={(value) => setRange(value as HoldingRange)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Revenue" value={formatCurrency(data?.totals.totalRevenue || 0)} />
        <MetricCard label="Total Redemptions" value={(data?.totals.totalRedemptions || 0).toString()} />
        <MetricCard label="Active Offers" value={(data?.totals.activeOffers || 0).toString()} />
        <MetricCard label="Total Discount" value={formatCurrency(data?.totals.totalDiscount || 0)} />
      </div>

      <section className="bg-white p-6 rounded-xl shadow-sm border">
        <h2 className="text-lg font-semibold mb-6">Revenue Overview</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.chartData || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="revenue" stroke="#16a34a" fill="#bbf7d0" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Vendor Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted border-b">
              <tr>
                <th className="px-6 py-4 font-medium">Vendor</th>
                <th className="px-6 py-4 font-medium text-right">Revenue</th>
                <th className="px-6 py-4 font-medium text-right">Redemptions</th>
                <th className="px-6 py-4 font-medium text-right">Discount</th>
                <th className="px-6 py-4 font-medium text-right">Pending</th>
                <th className="px-6 py-4 font-medium text-right">Offers</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(data?.vendors || []).map((vendor) => (
                <tr key={vendor.vendorId}>
                  <td className="px-6 py-4 font-medium">{vendor.vendorName}</td>
                  <td className="px-6 py-4 text-right">{formatCurrency(vendor.totalRevenue)}</td>
                  <td className="px-6 py-4 text-right">{vendor.totalRedemptions}</td>
                  <td className="px-6 py-4 text-right">{formatCurrency(vendor.totalDiscount)}</td>
                  <td className="px-6 py-4 text-right">{vendor.pendingTransactions}</td>
                  <td className="px-6 py-4 text-right">{vendor.activeOffers}</td>
                </tr>
              ))}
              {(!data?.vendors || data.vendors.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    No vendors are assigned to this holding group.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 bg-white rounded-xl shadow-sm border">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  )
}
