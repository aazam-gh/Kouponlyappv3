import { useQuery } from '@tanstack/react-query'
import { vendorTransactionsQueryOptions, vendorStatsQueryOptions } from '@/queries'
import { Loader2, FileText, DollarSign, Tag } from 'lucide-react'
import { useMemo } from 'react'

interface InvoiceSettingsProps {
    vendorId: string
}

export function InvoiceSettings({ vendorId }: InvoiceSettingsProps) {
    const { data: transactions, isLoading: txLoading } = useQuery(vendorTransactionsQueryOptions(vendorId))
    const { data: stats } = useQuery(vendorStatsQueryOptions(vendorId))

    const lastMonthTransactions = useMemo(() => {
        if (!transactions) return []
        const now = new Date()
        const oneMonthAgo = new Date()
        oneMonthAgo.setMonth(now.getMonth() - 1)
        return transactions.filter((tx) => {
            if (!tx.createdAt) return false
            return tx.createdAt.toDate() >= oneMonthAgo
        })
    }, [transactions])

    const monthStats = useMemo(() => {
        const completed = lastMonthTransactions.filter((tx) => tx.status === 'completed')
        return {
            count: lastMonthTransactions.length,
            revenue: completed.reduce((sum, tx) => sum + (tx.finalAmount || 0), 0),
            discount: completed.reduce((sum, tx) => sum + (tx.discountAmount || 0), 0),
        }
    }, [lastMonthTransactions])

    if (txLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="pt-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border p-5 space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">Transactions</span>
                    </div>
                    <p className="text-2xl font-bold">{monthStats.count}</p>
                    <p className="text-xs text-muted-foreground">Last 30 days</p>
                </div>
                <div className="bg-white rounded-2xl border p-5 space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        <span className="text-sm">Revenue</span>
                    </div>
                    <p className="text-2xl font-bold">QAR {monthStats.revenue.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Completed transactions</p>
                </div>
                <div className="bg-white rounded-2xl border p-5 space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Tag className="h-4 w-4" />
                        <span className="text-sm">Discounts Given</span>
                    </div>
                    <p className="text-2xl font-bold">QAR {monthStats.discount.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Total discounts</p>
                </div>
            </div>

            {/* All-time stats */}
            {stats && (
                <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>All-time: <strong>{stats.totalRedemptions}</strong> transactions</span>
                    <span>Revenue: <strong>QAR {stats.totalRevenue?.toFixed(2)}</strong></span>
                    <span>Pending: <strong>{stats.pendingTransactions}</strong></span>
                </div>
            )}

            {/* Transaction Table */}
            <div className="bg-white rounded-[2rem] shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted border-b">
                            <tr>
                                <th className="px-6 py-4 font-medium text-foreground">ID</th>
                                <th className="px-6 py-4 font-medium text-foreground">Date</th>
                                <th className="px-6 py-4 font-medium text-foreground">Type</th>
                                <th className="px-6 py-4 font-medium text-foreground">Amount</th>
                                <th className="px-6 py-4 font-medium text-foreground">Discount</th>
                                <th className="px-6 py-4 font-medium text-foreground">Final Amount</th>
                                <th className="px-6 py-4 font-medium text-foreground">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {lastMonthTransactions.map((tx) => (
                                <tr key={tx.id} className="hover:bg-muted/50 transition-colors">
                                    <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                                        {tx.id.slice(0, 8)}...
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground">
                                        {tx.createdAt?.toDate().toLocaleDateString() || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 capitalize">{tx.type || 'N/A'}</td>
                                    <td className="px-6 py-4">QAR {tx.totalAmount}</td>
                                    <td className="px-6 py-4 text-muted-foreground">
                                        {tx.discountType === 'buy1get1'
                                            ? 'Buy 1 Get 1'
                                            : tx.discountType === 'percentage'
                                                ? `${tx.discountValue ?? tx.discountAmount}%`
                                                : `QAR ${tx.discountAmount}`}
                                    </td>
                                    <td className="px-6 py-4 font-medium">QAR {tx.finalAmount}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tx.status === 'completed'
                                                ? 'bg-green-100 text-green-800'
                                                : tx.status === 'pending'
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : 'bg-red-100 text-red-800'
                                            }`}>
                                            {tx.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {lastMonthTransactions.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                                        No transactions in the last 30 days.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
