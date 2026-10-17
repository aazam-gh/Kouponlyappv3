import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

type Correction = { updatedAmount: number; previousAmount: number; reason: string; changedBy: string; changedAt: string }
type TransactionRecord = {
  id: string; source: 'redemption' | 'transaction'; userId: string; vendorId: string; offerId: string; email: string; studentName: string; studentPhone?: string
  firstName?: string; lastName?: string; dateOfBirth?: string; secondaryEmail?: string; university?: string
  vendor: string; offer: string; vendorEmail?: string; vendorPhone?: string; vendorAddress?: string
  code: string; consumedAt: string; status: string; roundId: string; periodId: string; currency?: string
  billAmount?: number | null; finalAmount?: number | null; discountAmount?: number | null; corrections?: Correction[]
}
type Activity = { total: number; allTime: number; thisMonth: number; uniqueUsers: number; receipts: TransactionRecord[] }

function csvCell(value: unknown) { return `"${String(value ?? '').replaceAll('"', '""')}"` }
function downloadCsv(rows: TransactionRecord[]) {
  const headers = ['Record type','Transaction ID','Date and time','Student ID','Student name','Student email','Student phone','University','Vendor ID','Vendor','Vendor email','Vendor phone','Vendor location','Offer ID','Offer','Bill amount','Discount','Amount paid','Currency','Status','Code','Round ID','Period ID']
  const lines = rows.map(r => [r.source,r.id,r.consumedAt,r.userId,r.studentName,r.email,r.studentPhone,r.university,r.vendorId,r.vendor,r.vendorEmail,r.vendorPhone,r.vendorAddress,r.offerId,r.offer,r.billAmount,r.discountAmount,r.finalAmount,r.currency,r.status,r.code,r.roundId,r.periodId].map(csvCell).join(','))
  const blob = new Blob([[headers.map(csvCell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'kouponly-transactions.csv'; anchor.click(); URL.revokeObjectURL(url)
}
const formatMoney = (value?: number | null, currency = 'INR') => value == null ? '—' : `${currency === 'INR' ? '₹' : `${currency} `}${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function TransactionActivity({ vendorId, userId, overview = false }: { vendorId?: string; userId?: string; overview?: boolean }) {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [corrections, setCorrections] = useState<Record<string, { amount: string; reason: string }>>({})
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['admin-transactions', vendorId, userId, search, page, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('kouponly_admin_coupons', {
        p_vendor_id: vendorId ?? null, p_user_id: userId ?? null, p_search: search,
        p_offset: page * 25, p_limit: 25, p_from: from || null, p_to: to || null,
      })
      if (error) throw error
      return data as Activity
    },
    refetchInterval: 30000,
  })
  const exportMutation = useMutation({
    mutationFn: async () => {
      const rows: TransactionRecord[] = []
      for (let offset = 0; offset < (query.data?.total ?? 0); offset += 100) {
        const { data, error } = await supabase.rpc('kouponly_admin_coupons', {
          p_vendor_id: vendorId ?? null, p_user_id: userId ?? null, p_search: search,
          p_offset: offset, p_limit: 100, p_from: from || null, p_to: to || null,
        })
        if (error) throw error
        rows.push(...((data as Activity).receipts ?? []))
      }
      return rows
    },
    onSuccess: downloadCsv,
    onError: error => toast.error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`),
  })
  const correctionMutation = useMutation({
    mutationFn: async ({ row, amount, reason }: { row: TransactionRecord; amount: string; reason: string }) => {
      const value = Number(amount)
      if (!Number.isFinite(value) || value < 0 || !reason.trim()) throw new Error('Enter a valid amount and reason.')
      const { error } = row.source === 'transaction'
        ? await supabase.rpc('kouponly_admin_correct_transaction_amount', { p_transaction_id: row.id, p_updated_amount: value, p_reason: reason.trim() })
        : await supabase.rpc('kouponly_admin_correct_redemption_amount', { p_user_id: row.userId, p_redemption_id: row.id, p_updated_amount: value, p_reason: reason.trim() })
      if (error) throw error
    },
    onSuccess: () => { toast.success('Correction recorded'); void queryClient.invalidateQueries({ queryKey: ['admin-transactions'] }) },
    onError: error => toast.error(error instanceof Error ? error.message : 'Correction failed'),
  })
  const data = query.data
  return <div className="mx-auto w-full max-w-[1440px] space-y-6 p-4 sm:p-7 lg:p-9">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-3xl font-semibold tracking-tight">{overview && vendorId ? 'Vendor transactions' : userId ? 'Transaction history' : 'Transactions'}</h1><p className="mt-1.5 text-sm text-muted-foreground">Completed transactions and coupon redemptions, with amounts paid after discounts.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>Refresh</Button><Button variant="outline" onClick={() => exportMutation.mutate()} disabled={!data?.total || exportMutation.isPending}>{exportMutation.isPending ? 'Preparing…' : 'Export CSV'}</Button></div>
    </div>
    {!(overview && vendorId) && <div className="grid gap-3 sm:grid-cols-3">
      <Metric title="Transactions in range" value={data?.total} />
      <Metric title="All time" value={data?.allTime} />
      <Metric title="Unique customers" value={data?.uniqueUsers} />
    </div>}
    {query.isError ? <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">Could not load transactions: {query.error.message}</div> : query.isPending ? <p className="text-sm text-muted-foreground">Loading transactions…</p> : <section className="overflow-hidden rounded-xl border bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b p-4 sm:p-5">
        <div><h2 className="font-semibold">Transaction history</h2><p className="mt-1 text-sm text-muted-foreground">Search, filter by date, inspect details, or export the filtered results.</p></div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs text-muted-foreground">From<Input aria-label="Transaction start date" type="date" value={from} max={to || undefined} onChange={e => {setFrom(e.target.value);setPage(0)}} /></label>
          <label className="grid gap-1 text-xs text-muted-foreground">To<Input aria-label="Transaction end date" type="date" value={to} min={from || undefined} onChange={e => {setTo(e.target.value);setPage(0)}} /></label>
          {(from || to) && <Button variant="ghost" onClick={() => {setFrom('');setTo('');setPage(0)}}>Clear dates</Button>}
          <form className="w-full sm:w-56" onSubmit={e => {e.preventDefault();setSearch(searchInput.trim());setPage(0)}}>
            <Input className="w-full bg-white" aria-label="Search transactions" placeholder="Search name, email, phone, or vendor" maxLength={200} value={searchInput} onChange={e => setSearchInput(e.target.value)} />
          </form>
        </div>
      </div>
      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date and time</TableHead><TableHead>Student</TableHead><TableHead>Vendor / offer</TableHead><TableHead>Amount paid</TableHead><TableHead>Details</TableHead></TableRow></TableHeader><TableBody>
        {data?.receipts.map(row => <TableRow key={`${row.userId}-${row.id}`}>
          <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(row.consumedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</TableCell>
          <TableCell><Link className="font-medium underline-offset-4 hover:underline" to="/admin/students/$studentId/settings" params={{studentId:row.userId}} search={{page:1,pageSize:10,search:'',sort:'created_desc'}}>{row.studentName || row.email}</Link></TableCell>
          <TableCell><Link className="font-medium underline-offset-4 hover:underline" to="/admin/vendors/$vendorId/settings/invoices" params={{vendorId:row.vendorId}} search={{page:1,pageSize:10}}>{row.vendor}</Link><p className="mt-1 text-xs text-muted-foreground">{row.offer}</p></TableCell>
          <TableCell className="whitespace-nowrap font-medium tabular-nums">{formatMoney(row.finalAmount, row.currency)}</TableCell>
          <TableCell><details className="min-w-64"><summary className="cursor-pointer text-sm font-medium text-primary">View details</summary>
            <div className="mt-3 space-y-3 rounded-lg bg-muted/40 p-3 text-xs">
              <div className="grid gap-1"><p><b>Bill before discount:</b> {formatMoney(row.billAmount,row.currency)}</p><p><b>Discount:</b> {formatMoney(row.discountAmount,row.currency)}</p><p><b>Amount paid:</b> {formatMoney(row.finalAmount,row.currency)}</p><p><b>Status:</b> {row.status}</p><p><b>Code:</b> {row.code || '—'}</p><p className="break-all"><b>Transaction:</b> {row.id}</p></div>
              <div className="grid gap-1 border-t pt-2"><b>Student details</b><p>{row.studentName} · {row.email || 'No email'}</p><p>{row.studentPhone || 'No phone'}{row.secondaryEmail ? ` · ${row.secondaryEmail}` : ''}</p>{row.dateOfBirth && <p>Date of birth: {row.dateOfBirth}</p>}{row.university && <p>{row.university}</p>}</div>
              <div className="grid gap-1 border-t pt-2"><b>Vendor details</b><p>{row.vendor}</p><p>{row.vendorEmail || 'No email'}{row.vendorPhone ? ` · ${row.vendorPhone}` : ''}</p><p>{row.vendorAddress || 'No location recorded'}</p></div>
              <div className="grid gap-2 border-t pt-2"><b>Correct amount paid</b><p className="text-muted-foreground">A correction appends an audit entry with the previous amount, your account, time, and reason.</p>
                <form className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]" onSubmit={e => {e.preventDefault();const form=corrections[row.id] ?? {amount:String(row.finalAmount ?? ''),reason:''};correctionMutation.mutate({row,...form})}}>
                  <Input aria-label="Corrected amount" inputMode="decimal" placeholder="Amount paid" value={corrections[row.id]?.amount ?? String(row.finalAmount ?? '')} onChange={e => setCorrections(v => ({...v,[row.id]:{...(v[row.id] ?? {amount:String(row.finalAmount ?? ''),reason:''}),amount:e.target.value}}))} />
                  <Input aria-label="Correction reason" placeholder="Reason" maxLength={500} value={corrections[row.id]?.reason ?? ''} onChange={e => setCorrections(v => ({...v,[row.id]:{...(v[row.id] ?? {amount:String(row.finalAmount ?? ''),reason:''}),reason:e.target.value}}))} />
                  <Button size="sm" disabled={correctionMutation.isPending}>Save correction</Button>
                </form>
                {row.corrections?.map((c,i) => <p key={`${c.changedAt}-${i}`}>₹{c.previousAmount} → ₹{c.updatedAmount} · {c.reason} · {new Date(c.changedAt).toLocaleString('en-IN')}</p>)}
              </div>
            </div>
          </details></TableCell>
        </TableRow>)}
        {data && !data.receipts.length && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No transactions found.</TableCell></TableRow>}
      </TableBody></Table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4"><span className="text-sm text-muted-foreground">Page {page+1} · {data?.total ?? '…'} matching records</span><div className="flex gap-2"><Button variant="outline" disabled={page===0 || query.isFetching} onClick={() => setPage(page-1)}>Previous</Button><Button variant="outline" disabled={!data || (page+1)*25>=data.total || query.isFetching} onClick={() => setPage(page+1)}>Next</Button></div></div>
    </section>}
  </div>
}

function Metric({ title, value }: { title: string; value?: number }) {
  return <div className="rounded-xl border bg-white p-4"><p className="text-sm text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value?.toLocaleString('en-IN') ?? '—'}</p></div>
}
