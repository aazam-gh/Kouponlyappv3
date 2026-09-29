import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { vendorTransactionsQueryOptions } from '@/queries'
import { useAuth } from '@/auth'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/(vendor-panel)/_vendor/transaction-history/')({
  component: VendorTransactionHistory,
})

function VendorTransactionHistory() {
  const { user } = useAuth()
  const vendorId = user?.uid || ''
  const navigate = useNavigate()

  const { data: transactions, isLoading, error } = useQuery(vendorTransactionsQueryOptions(vendorId))

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>
  }

  if (error) {
    return <div className="flex justify-center items-center h-64 text-destructive">Failed to load transactions: {error.message}</div>
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Transaction History</h1>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
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
              {transactions?.map((tx) => (
                <tr
                  key={tx.id}
                  className="hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate({ to: '/transaction-history/$transactionId', params: { transactionId: tx.id } })}
                >
                  <td className="px-6 py-4 text-muted-foreground font-mono text-xs">{tx.id.slice(0, 8)}...</td>
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
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      tx.status === 'completed' ? 'bg-green-100 text-green-800' :
                      tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
              {(!transactions || transactions.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    No transactions found.
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
