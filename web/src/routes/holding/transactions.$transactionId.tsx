import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { getHoldingTransaction } from '@/lib/holding-groups'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/holding/transactions/$transactionId')({
  component: HoldingTransactionDetail,
})

function formatCurrency(value: number) {
  return `QAR ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Unknown Date'
}

function HoldingTransactionDetail() {
  const { transactionId } = Route.useParams()
  const { data: transaction, isLoading, error } = useQuery({
    queryKey: ['holding-transaction', transactionId],
    queryFn: () => getHoldingTransaction(transactionId),
  })

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>
  }

  if (error) {
    return <div className="p-8 text-destructive">Failed to load transaction: {error.message}</div>
  }

  if (!transaction) {
    return <div className="p-8 text-muted-foreground">Transaction not found.</div>
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <Button variant="outline" asChild className="gap-2">
        <Link to="/holding/transactions">
          <ArrowLeft className="h-4 w-4" />
          Back to Transactions
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold">Transaction Details</h1>
        <p className="text-muted-foreground font-mono text-sm">{transaction.id}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailCard label="Vendor" value={transaction.vendorName} />
        <DetailCard label="Date" value={formatDate(transaction.createdAt)} />
        <DetailCard label="Type" value={transaction.type.replace(/_/g, ' ')} />
        <DetailCard label="Status" value={transaction.status} />
        <DetailCard label="Total Amount" value={formatCurrency(transaction.totalAmount)} />
        <DetailCard label="Discount" value={formatCurrency(transaction.discountAmount)} />
        <DetailCard label="Final Amount" value={formatCurrency(transaction.finalAmount)} />
        <DetailCard label="User ID" value={transaction.userId || 'N/A'} />
        <DetailCard label="Offer ID" value={transaction.offerId || 'N/A'} />
        <DetailCard label="PIN" value={transaction.pin || 'N/A'} />
        <DetailCard label="Creator Code" value={transaction.creatorCode || 'N/A'} />
        <DetailCard label="Remaining Amount" value={formatCurrency(transaction.remainingAmount || 0)} />
      </div>
    </div>
  )
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold break-words">{value}</p>
    </div>
  )
}
