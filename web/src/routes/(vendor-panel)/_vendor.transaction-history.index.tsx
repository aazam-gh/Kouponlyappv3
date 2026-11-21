import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { VENDOR_TRANSACTION_PAGE_SIZE, vendorMembershipQueryOptions, vendorTransactionsQueryOptions, type VendorPortalTransaction } from '@/queries'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/auth'
import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

export const Route = createFileRoute('/(vendor-panel)/_vendor/transaction-history/')({
  component: VendorTransactionHistory,
})

function VendorTransactionHistory() {
  const { user } = useAuth()
  const membership = useQuery(vendorMembershipQueryOptions(user?.id || ''))
  const queryClient = useQueryClient()
  const vendorId = membership.data || ''
  const navigate = useNavigate()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const [exporting, setExporting] = useState(false)

  const { data: transactions, isLoading, error } = useQuery({
    ...vendorTransactionsQueryOptions(vendorId, from, to, page * VENDOR_TRANSACTION_PAGE_SIZE),
    enabled: !!vendorId,
  })

  const exportTransactions = async () => {
    setExporting(true)
    try {
      const allTransactions: VendorPortalTransaction[] = []
      for (let offset = 0; ; offset += VENDOR_TRANSACTION_PAGE_SIZE) {
        const batch = await queryClient.fetchQuery({
          ...vendorTransactionsQueryOptions(vendorId, from, to, offset),
          staleTime: 0,
        })
        allTransactions.push(...batch)
        if (batch.length < VENDOR_TRANSACTION_PAGE_SIZE) break
      }
      const rows = allTransactions.map(tx => ({
        Date: new Date(tx.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        Student: tx.studentName || 'Student',
        Phone: tx.studentPhone || '',
        Offer: tx.offerTitle,
        Type: tx.source === 'redemption' ? 'Coupon redemption' : 'Transaction',
        'Bill amount': tx.totalAmount,
        Discount: tx.discountAmount,
        'Amount paid': tx.finalAmount,
        Status: tx.status,
      }))
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows, { header: ['Date', 'Student', 'Phone', 'Offer', 'Type', 'Bill amount', 'Discount', 'Amount paid', 'Status'] }), 'Transactions')
      XLSX.writeFile(workbook, `kouponly-transactions-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not export transactions.')
    } finally {
      setExporting(false)
    }
  }

  if (membership.isLoading || isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>
  }

  if (membership.error || error) {
    return <div role="alert" className="flex justify-center items-center h-64 text-destructive">Failed to load transactions: {(membership.error || error)?.message}</div>
  }

  return (
    <div className="min-w-0 space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="text-2xl font-bold">Transaction History</h1><div className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-xs text-muted-foreground">From<input type="date" aria-label="Vendor transactions start date" value={from} max={to || undefined} onChange={e => { setFrom(e.target.value); setPage(0) }} className="rounded-md border px-2 py-1" /></label><label className="grid gap-1 text-xs text-muted-foreground">To<input type="date" aria-label="Vendor transactions end date" value={to} min={from || undefined} onChange={e => { setTo(e.target.value); setPage(0) }} className="rounded-md border px-2 py-1" /></label>{(from || to) && <button className="self-end text-sm underline" onClick={() => { setFrom(''); setTo(''); setPage(0) }}>Clear dates</button>}<Button variant="outline" disabled={exporting || !vendorId} onClick={() => void exportTransactions()}><Download className="mr-2 size-4" />{exporting ? 'Exporting…' : 'Export Excel'}</Button></div></div>

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
                  className={tx.source === 'transaction' ? 'hover:bg-muted/50 cursor-pointer transition-colors' : 'hover:bg-muted/50'}
                  onClick={tx.source === 'transaction' ? () => navigate({ to: '/transaction-history/$transactionId', params: { transactionId: tx.id } }) : undefined}
                >
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) || 'N/A'}
                  </td>
                  <td className="px-6 py-4">{tx.studentName || 'Student'}</td>
                  <td className="px-6 py-4">{tx.studentPhone || '—'}</td>
                  <td className="px-6 py-4">{tx.offerTitle}{tx.source === 'redemption' && <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs">Coupon redemption</span>}</td>
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
        <nav aria-label="Transaction pages" className="flex items-center justify-between gap-3 border-t p-3">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage(current => current - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page + 1}</span>
          <Button variant="outline" disabled={(transactions?.length ?? 0) < VENDOR_TRANSACTION_PAGE_SIZE} onClick={() => setPage(current => current + 1)}>Next</Button>
        </nav>
      </div>
    </div>
  )
}
