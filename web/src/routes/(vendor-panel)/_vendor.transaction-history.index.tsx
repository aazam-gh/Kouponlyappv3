import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { vendorTransactionsQueryOptions } from '@/queries'
import { useAuth } from '@/auth'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/(vendor-panel)/_vendor/transaction-history/')({
  component: VendorTransactionHistory,
})

function VendorTransactionHistory() {
  const { user } = useAuth()
  const vendorId = user?.uid || ''
  const navigate = useNavigate()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const { data: transactions, isLoading, error } = useQuery(vendorTransactionsQueryOptions(vendorId, from, to))

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>
  }

  if (error) {
    return <div className="flex justify-center items-center h-64 text-destructive">Failed to load transactions: {error.message}</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="text-2xl font-bold">Transaction History</h1><div className="flex flex-wrap gap-2"><label className="grid gap-1 text-xs text-muted-foreground">From<input type="date" aria-label="Vendor transactions start date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className="rounded-md border px-2 py-1" /></label><label className="grid gap-1 text-xs text-muted-foreground">To<input type="date" aria-label="Vendor transactions end date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className="rounded-md border px-2 py-1" /></label>{(from || to) && <button className="self-end text-sm underline" onClick={() => {setFrom('');setTo('')}}>Clear dates</button>}</div></div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted border-b">
              <tr>
                <th className="px-6 py-4 font-medium text-foreground">Date</th>
                <th className="px-6 py-4 font-medium text-foreground">Student</th>
                <th className="px-6 py-4 font-medium text-foreground">Phone</th>
                <th className="px-6 py-4 font-medium text-foreground">Offer</th>
                <th className="px-6 py-4 font-medium text-foreground">Bill amount</th>
                <th className="px-6 py-4 font-medium text-foreground">Discount</th>
                <th className="px-6 py-4 font-medium text-foreground">Amount paid</th>
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
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) || 'N/A'}
                  </td>
                  <td className="px-6 py-4">{tx.studentName || 'Student'}</td>
                  <td className="px-6 py-4">{tx.studentPhone || '—'}</td>
                  <td className="px-6 py-4">{tx.offerTitle}</td>
                  <td className="px-6 py-4">₹{Number(tx.totalAmount).toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    ₹{Number(tx.discountAmount).toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 font-medium">₹{Number(tx.finalAmount).toLocaleString('en-IN')}</td>
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
                  <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
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
