import { createLazyFileRoute, Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Database, Eye, Receipt, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { STALE_TIME } from '@/lib/constants'
import type { Transaction } from '../transactions'
import {
    fetchBigQueryTransactions,
    type BigQueryTransactionSearch,
    type BigQueryTransactionSort,
} from './index'

export const Route = createLazyFileRoute('/admin/bigquery-transactions/')({
    component: BigQueryTransactionsRoute,
})

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

function SortIcon({ field, sort }: { field: 'date' | 'amount' | 'vendor'; sort?: string }) {
    if (!sort || !sort.startsWith(field)) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground/50" />
    return sort.endsWith('asc')
        ? <ArrowUp className="ml-1 h-3.5 w-3.5 text-blue-500" />
        : <ArrowDown className="ml-1 h-3.5 w-3.5 text-blue-500" />
}

function BigQueryTransactionsRoute() {
    const search = useSearch({ from: '/admin/bigquery-transactions/' })
    const { page, pageSize, vendorName, sort, cursor, history } = search
    const navigate = useNavigate()
    const [vendorInput, setVendorInput] = useState(vendorName || '')
    const { data, isLoading, isFetching, error } = useQuery({
        queryKey: ['bigquery-transactions-list', pageSize, vendorName, sort, cursor],
        queryFn: () => fetchBigQueryTransactions(pageSize, vendorName, sort, cursor),
        staleTime: STALE_TIME.MEDIUM,
    })

    useEffect(() => {
        setVendorInput(vendorName || '')
    }, [vendorName])

    useEffect(() => {
        const nextVendorName = vendorInput.trim()
        if (nextVendorName === (vendorName || '')) return

        const timeout = window.setTimeout(() => {
            const nextSearch: BigQueryTransactionSearch = {
                page: 1,
                pageSize,
            }
            if (nextVendorName) nextSearch.vendorName = nextVendorName
            if (sort) nextSearch.sort = sort

            void navigate({
                to: '/admin/bigquery-transactions',
                search: nextSearch,
            })
        }, 500)

        return () => window.clearTimeout(timeout)
    }, [navigate, pageSize, sort, vendorInput, vendorName])

    const updateSearch = (updates: Partial<BigQueryTransactionSearch>) => {
        const nextSearch: BigQueryTransactionSearch = {
            page: 1,
            pageSize,
        }
        const nextVendorName = Object.hasOwn(updates, 'vendorName') ? updates.vendorName : vendorName
        const nextSort = Object.hasOwn(updates, 'sort') ? updates.sort : sort

        if (nextVendorName) nextSearch.vendorName = nextVendorName
        if (nextSort) nextSearch.sort = nextSort

        navigate({
            to: '/admin/bigquery-transactions',
            search: nextSearch,
        })
    }
    const toggleSort = (field: 'date' | 'amount' | 'vendor') => {
        const next = !sort || !sort.startsWith(field) || sort.endsWith('asc')
            ? `${field}_desc`
            : `${field}_asc`
        updateSearch({ sort: next as BigQueryTransactionSort })
    }
    const goNext = () => {
        if (!data?.nextCursor) return
        const cursorHistory = history ? history.split('.') : []
        const nextSearch: BigQueryTransactionSearch = {
            page: page + 1,
            pageSize,
            cursor: data.nextCursor,
            history: [...cursorHistory, cursor || 'first'].join('.'),
        }

        if (vendorName) nextSearch.vendorName = vendorName
        if (sort) nextSearch.sort = sort

        navigate({
            to: '/admin/bigquery-transactions',
            search: nextSearch,
        })
    }
    const goPrevious = () => {
        const cursorHistory = history ? history.split('.') : []
        const previous = cursorHistory.pop()
        const previousSearch: BigQueryTransactionSearch = {
            page: Math.max(1, page - 1),
            pageSize,
        }

        if (vendorName) previousSearch.vendorName = vendorName
        if (sort) previousSearch.sort = sort
        if (previous && previous !== 'first') previousSearch.cursor = previous
        if (cursorHistory.length) previousSearch.history = cursorHistory.join('.')

        navigate({
            to: '/admin/bigquery-transactions',
            search: previousSearch,
        })
    }

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-6 p-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                    <div className="rounded bg-blue-50 p-2"><Database className="h-5 w-5 text-blue-600" /></div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
                        <p className="text-sm text-muted-foreground">
                            Complete transaction archive from BigQuery. Recent changes may take a moment to sync.
                        </p>
                    </div>
                </div>
                <Button asChild variant="outline" className="gap-2">
                    <Link to="/admin/transactions">
                        <Receipt className="h-4 w-4" />
                        Daily Transactions
                    </Link>
                </Button>
            </div>

            {data && (
                <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">Query: {data.query.durationMs} ms</Badge>
                    <Badge variant="secondary">Processed: {formatBytes(data.query.bytesProcessed)}</Badge>
                    <Badge variant="secondary">Billed: {formatBytes(data.query.bytesBilled)}</Badge>
                    <Badge variant="secondary">{data.query.cacheHit ? 'Cache hit' : 'Cache miss'}</Badge>
                    <Badge variant="outline">
                        Freshness: {data.freshness ? new Date(data.freshness).toLocaleString() : 'No exported rows'}
                    </Badge>
                    {isFetching && !isLoading && (
                        <Badge variant="outline">Refreshing archive...</Badge>
                    )}
                </div>
            )}

            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Filter by exact vendor name..."
                        className="h-10 border-none bg-muted/50 pl-9"
                        value={vendorInput}
                        onChange={(event) => setVendorInput(event.target.value)}
                    />
                </div>
                <Select value={sort || 'date_desc'} onValueChange={(value) => updateSearch({ sort: value as BigQueryTransactionSort })}>
                    <SelectTrigger className="h-10 w-[200px] border-none bg-muted/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="date_desc">Date: Newest First</SelectItem>
                        <SelectItem value="date_asc">Date: Oldest First</SelectItem>
                        <SelectItem value="amount_desc">Amount: High to Low</SelectItem>
                        <SelectItem value="amount_asc">Amount: Low to High</SelectItem>
                        <SelectItem value="vendor_asc">Vendor: A-Z</SelectItem>
                        <SelectItem value="vendor_desc">Vendor: Z-A</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="rounded-md bg-white">
                <Table>
                    <TableHeader>
                        <TableRow className="border-none hover:bg-transparent">
                            <TableHead className="cursor-pointer font-bold text-black" onClick={() => toggleSort('date')}>
                                <span className="inline-flex items-center">Date <SortIcon field="date" sort={sort} /></span>
                            </TableHead>
                            <TableHead className="font-bold text-black">Type/Offer</TableHead>
                            <TableHead className="font-bold text-black">User</TableHead>
                            <TableHead className="cursor-pointer font-bold text-black" onClick={() => toggleSort('vendor')}>
                                <span className="inline-flex items-center">Vendor <SortIcon field="vendor" sort={sort} /></span>
                            </TableHead>
                            <TableHead className="cursor-pointer text-right font-bold text-black" onClick={() => toggleSort('amount')}>
                                <span className="inline-flex items-center">Amount <SortIcon field="amount" sort={sort} /></span>
                            </TableHead>
                            <TableHead className="text-right font-bold text-black">Rewards/Benefits</TableHead>
                            <TableHead className="text-right font-bold text-black">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={7} className="py-10 text-center">Loading the transaction archive...</TableCell></TableRow>
                        ) : error ? (
                            <TableRow><TableCell colSpan={7} className="py-10 text-center text-red-600">{error.message}</TableCell></TableRow>
                        ) : !data?.transactions.length ? (
                            <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No exported transactions found.</TableCell></TableRow>
                        ) : data.transactions.map((transaction: Transaction) => (
                            <TableRow
                                key={transaction.id}
                                className="h-20 cursor-pointer border-b border-gray-100 hover:bg-gray-50/50"
                                onClick={() => navigate({ to: '/admin/transactions/$id', params: { id: transaction.id } })}
                            >
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="whitespace-nowrap font-medium">{transaction.date}</span>
                                        <span className="font-mono text-[10px] text-muted-foreground">ID: {transaction.transactionId}</span>
                                    </div>
                                </TableCell>
                                <TableCell><Badge className="w-fit">{transaction.type.replace(/_/g, ' ')}</Badge></TableCell>
                                <TableCell>
                                    {transaction.userId ? (
                                        <Link
                                            to="/admin/students/$studentId/settings"
                                            params={{ studentId: transaction.userId }}
                                            search={{ page: 1, pageSize: 10, search: '' }}
                                            className="font-bold text-blue-600 hover:underline"
                                            onClick={(event) => event.stopPropagation()}
                                        >{transaction.userId.slice(0, 8)}...</Link>
                                    ) : 'N/A'}
                                </TableCell>
                                <TableCell>
                                    {transaction.vendorId ? (
                                        <Link
                                            to="/admin/vendors/$vendorId/settings"
                                            params={{ vendorId: transaction.vendorId }}
                                            search={{ page: 1, pageSize: 10 }}
                                            className="font-bold text-blue-600 hover:underline"
                                            onClick={(event) => event.stopPropagation()}
                                        >{transaction.vendorName}</Link>
                                    ) : transaction.vendorName}
                                </TableCell>
                                <TableCell className="text-right font-bold">
                                    {transaction.type === 'online_redemption' ? 'Online' : transaction.finalAmount !== null && transaction.finalAmount !== undefined
                                        ? `QAR ${transaction.finalAmount}`
                                        : transaction.totalAmount}
                                </TableCell>
                                <TableCell className="text-right text-sm">
                                    {transaction.cashbackAmount ? <span className="font-bold text-green-600">+QAR {transaction.cashbackAmount}</span> : '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm"><Eye className="mr-2 h-4 w-4" />Details</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {(page > 1 || Boolean(data?.nextCursor)) && (
                <div className="flex items-center justify-center gap-4 pt-4">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={goPrevious}>‹ Previous</Button>
                    <span className="text-sm font-medium text-muted-foreground">Page {page}</span>
                    <Button variant="outline" size="sm" disabled={!data?.nextCursor} onClick={goNext}>Next ›</Button>
                </div>
            )}
        </div>
    )
}
