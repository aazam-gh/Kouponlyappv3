import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import {
  getMyHoldingProfile,
  listHoldingTransactions,
  type HoldingTransaction,
} from '@/lib/holding-groups'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const Route = createFileRoute('/holding/transactions')({
  component: HoldingTransactions,
})

function formatCurrency(value: number) {
  return `QAR ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Unknown Date'
}

function HoldingTransactions() {
  const navigate = useNavigate()
  const [vendorFilter, setVendorFilter] = useState('all')
  const [cursor, setCursor] = useState<string | null>(null)
  const [pages, setPages] = useState<HoldingTransaction[][]>([])

  const { data: profile } = useQuery({
    queryKey: ['holding-profile'],
    queryFn: getMyHoldingProfile,
  })

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['holding-transactions', vendorFilter, cursor],
    queryFn: () => listHoldingTransactions({
      pageSize: 50,
      cursor,
      vendorId: vendorFilter === 'all' ? undefined : vendorFilter,
    }),
  })

  const transactions = cursor ? pages.flat().concat(data?.transactions || []) : data?.transactions || []
  const nextCursor = data?.nextCursor || null

  const loadMore = () => {
    if (!data?.nextCursor) return
    setPages((current) => current.concat([data.transactions]))
    setCursor(data.nextCursor)
  }

  const changeVendor = (vendorId: string) => {
    setVendorFilter(vendorId)
    setCursor(null)
    setPages([])
  }

  if (isLoading && !data) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>
  }

  if (error) {
    return <div className="p-8 text-destructive">Failed to load transactions: {error.message}</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">Read-only transaction history for assigned vendors.</p>
        </div>
        <Select value={vendorFilter} onValueChange={changeVendor}>
          <SelectTrigger className="w-[240px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            {(profile?.vendors || []).map((vendor) => (
              <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted border-b">
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Vendor</th>
                <th className="px-6 py-4 font-medium">User</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium text-right">Amount</th>
                <th className="px-6 py-4 font-medium text-right">Discount</th>
                <th className="px-6 py-4 font-medium text-right">Final</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  onOpen={() => navigate({
                    to: '/holding/transactions/$transactionId',
                    params: { transactionId: transaction.id },
                  })}
                />
              ))}
              {!transactions.length && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {nextCursor && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  )
}

function TransactionRow({
  transaction,
  onOpen,
}: {
  transaction: HoldingTransaction
  onOpen: () => void
}) {
  return (
    <tr className="hover:bg-muted/50 cursor-pointer transition-colors" onClick={onOpen}>
      <td className="px-6 py-4 whitespace-nowrap">{formatDate(transaction.createdAt)}</td>
      <td className="px-6 py-4 font-medium">{transaction.vendorName}</td>
      <td className="px-6 py-4 text-muted-foreground font-mono text-xs">{transaction.userId?.slice(0, 8) || 'N/A'}</td>
      <td className="px-6 py-4 capitalize">{transaction.type.replace(/_/g, ' ')}</td>
      <td className="px-6 py-4 text-right">{formatCurrency(transaction.totalAmount)}</td>
      <td className="px-6 py-4 text-right">{formatCurrency(transaction.discountAmount)}</td>
      <td className="px-6 py-4 text-right font-medium">{formatCurrency(transaction.finalAmount)}</td>
      <td className="px-6 py-4">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          transaction.status === 'completed' ? 'bg-green-100 text-green-800' :
            transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
        }`}>
          {transaction.status}
        </span>
      </td>
    </tr>
  )
}
