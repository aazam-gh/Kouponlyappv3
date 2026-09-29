import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { transactionQueryOptions } from '@/queries'
import { Loader2, ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/(vendor-panel)/_vendor/transaction-history/$transactionId')({
  component: TransactionDetail,
})

function TransactionDetail() {
  const { transactionId } = Route.useParams()
  const navigate = useNavigate()
  const { data: tx, isLoading, error } = useQuery(transactionQueryOptions(transactionId))

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>
  }

  if (error || !tx) {
    return (
      <div className="p-6 space-y-4">
        <button onClick={() => navigate({ to: '/transaction-history' })} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Transactions
        </button>
        <div className="flex justify-center items-center h-64 text-destructive">
          Transaction not found.
        </div>
      </div>
    )
  }

  const statusColor = tx.status === 'completed'
    ? 'bg-green-100 text-green-800'
    : tx.status === 'pending'
    ? 'bg-yellow-100 text-yellow-800'
    : 'bg-red-100 text-red-800'

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate({ to: '/transaction-history' })} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl font-bold">Transaction Details</h1>
      </div>

      {/* Status Banner */}
      <div className="flex items-center gap-3 bg-white rounded-xl shadow-sm border px-6 py-4">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColor}`}>
          {tx.status}
        </span>
        <span className="text-muted-foreground font-mono text-xs">{tx.id}</span>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DetailCard title="Transaction Info">
          <DetailRow label="Transaction ID" value={tx.id} mono />
          <DetailRow label="Date" value={tx.createdAt?.toDate().toLocaleString() || 'N/A'} />
          <DetailRow label="Type" value={tx.type ? tx.type.charAt(0).toUpperCase() + tx.type.slice(1) : 'N/A'} />
          <DetailRow label="Status" value={tx.status} badge={statusColor} />
        </DetailCard>

        <DetailCard title="Payment">
          <DetailRow label="Total Amount" value={`QAR ${tx.totalAmount}`} />
          <DetailRow label="Discount Type" value={tx.discountType === 'buy1get1' ? 'Buy 1 Get 1' : tx.discountType ? tx.discountType.charAt(0).toUpperCase() + tx.discountType.slice(1) : 'N/A'} />
          <DetailRow label="Discount Value" value={tx.discountType === 'buy1get1' ? 'Buy 1 Get 1' : tx.discountType === 'percentage' ? `${tx.discountValue ?? tx.discountAmount}%` : `QAR ${tx.discountAmount}`} />
          <DetailRow label="Final Amount" value={`QAR ${tx.finalAmount}`} highlight />
        </DetailCard>

        {(tx.cashbackAmount != null || tx.creatorCashbackAmount != null) && (
          <DetailCard title="Cashback">
            {tx.cashbackAmount != null && <DetailRow label="Cashback Amount" value={`QAR ${tx.cashbackAmount}`} />}
            {tx.creatorCashbackAmount != null && <DetailRow label="Creator Cashback" value={`QAR ${tx.creatorCashbackAmount}`} />}
          </DetailCard>
        )}

        {(tx.offerId || tx.pin) && (
          <DetailCard title="Offer & Redemption">
            {tx.offerId && <DetailRow label="Offer ID" value={tx.offerId} mono />}
            {tx.pin && <DetailRow label="PIN" value={tx.pin} mono />}
            {tx.redemptionCardAmount != null && <DetailRow label="Redemption Card Amount" value={`QAR ${tx.redemptionCardAmount}`} />}
            {tx.remainingAmount != null && <DetailRow label="Remaining Amount" value={`QAR ${tx.remainingAmount}`} />}
          </DetailCard>
        )}

        {tx.creatorCode && (
          <DetailCard title="Creator Code">
            <DetailRow label="Creator Code" value={tx.creatorCode} />
            {tx.creatorUid && <DetailRow label="Creator UID" value={tx.creatorUid} mono />}
            {tx.creatorCodeOwnerId && <DetailRow label="Creator Code Owner" value={tx.creatorCodeOwnerId} mono />}
          </DetailCard>
        )}
      </div>
    </div>
  )
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border">
      <div className="px-6 py-4 border-b">
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      <div className="divide-y">{children}</div>
    </div>
  )
}

function DetailRow({ label, value, mono, badge, highlight }: { label: string; value: string; mono?: boolean; badge?: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center px-6 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      {badge ? (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge}`}>{value}</span>
      ) : (
        <span className={`text-sm ${highlight ? 'font-bold text-foreground' : 'text-foreground'} ${mono ? 'font-mono text-xs' : ''}`}>
          {value}
        </span>
      )}
    </div>
  )
}
