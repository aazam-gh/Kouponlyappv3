import { createLazyFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { Database, Eye, Loader2, Receipt, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { functions } from '@/firebase/config'
import {
    DAILY_TRANSACTIONS_QUERY_KEY,
    dailyTransactionsQuery,
    fetchDailyTransactions,
    getQatarDayBounds,
    mapTransactionSnapshot,
    type Transaction,
} from './index'

export const Route = createLazyFileRoute('/admin/transactions/')({
    component: DailyTransactionsRoute,
})

function DailyTransactionsRoute() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [qatarDay, setQatarDay] = useState(getQatarDayBounds)
    const activeQueryKey = useMemo(
        () => [...DAILY_TRANSACTIONS_QUERY_KEY, qatarDay.dayKey] as const,
        [qatarDay.dayKey],
    )

    const { data: transactionList = [], isLoading, error } = useQuery({
        queryKey: activeQueryKey,
        queryFn: () => fetchDailyTransactions(qatarDay.start, qatarDay.end),
        staleTime: Infinity,
    })

    useEffect(() => {
        const delayUntilTomorrow = Math.max(
            1_000,
            qatarDay.end.getTime() - Date.now() + 1_000,
        )
        const timeout = window.setTimeout(() => {
            setQatarDay(getQatarDayBounds())
        }, delayUntilTomorrow)

        return () => window.clearTimeout(timeout)
    }, [qatarDay.end])

    useEffect(() => {
        return onSnapshot(
            dailyTransactionsQuery(qatarDay.start, qatarDay.end),
            (snapshot) => {
                queryClient.setQueryData(
                    activeQueryKey,
                    snapshot.docs.map(mapTransactionSnapshot),
                )
            },
            (snapshotError) => {
                toast.error(`Unable to refresh daily transactions: ${snapshotError.message}`)
            },
        )
    }, [activeQueryKey, qatarDay.end, qatarDay.start, queryClient])

    useEffect(() => {
        if (
            selectedTransactionId &&
            !transactionList.some((transaction) => transaction.id === selectedTransactionId)
        ) {
            setSelectedTransactionId(null)
        }
    }, [selectedTransactionId, transactionList])

    const selectedTransaction =
        transactionList.find((transaction) => transaction.id === selectedTransactionId) ?? null
    const selectedTransactionLabel =
        selectedTransaction?.pin ||
        selectedTransaction?.transactionId ||
        selectedTransaction?.id ||
        ''

    const deleteTransactionMutation = useMutation({
        mutationFn: async (transactionId: string) => {
            const callable = httpsCallable<
                { transactionId: string },
                { success: true }
            >(functions, 'deleteTransaction')
            await callable({ transactionId })
            return transactionId
        },
        onMutate: async (transactionId) => {
            await queryClient.cancelQueries({ queryKey: activeQueryKey })
            const previousTransactions =
                queryClient.getQueryData<Transaction[]>(activeQueryKey) ?? []

            queryClient.setQueryData<Transaction[]>(
                activeQueryKey,
                previousTransactions.filter((transaction) => transaction.id !== transactionId),
            )

            setSelectedTransactionId(null)
            setDeleteDialogOpen(false)

            return { previousTransactions }
        },
        onSuccess: () => {
            toast.success('Transaction deleted successfully.')
        },
        onError: (mutationError, _transactionId, context) => {
            if (context?.previousTransactions) {
                queryClient.setQueryData(
                    activeQueryKey,
                    context.previousTransactions,
                )
            }
            const message =
                mutationError instanceof Error
                    ? mutationError.message
                    : 'Failed to delete transaction.'
            toast.error(message)
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: DAILY_TRANSACTIONS_QUERY_KEY })
            void queryClient.invalidateQueries({ queryKey: ['bigquery-transactions-list'] })
        },
    })

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-6 p-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                    <div className="rounded bg-blue-50 p-2">
                        <Receipt className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Daily Transactions</h1>
                        <p className="text-sm text-muted-foreground">
                            All transactions from today, updated live from Firestore (Qatar time).
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {selectedTransaction && (
                        <Button
                            variant="destructive"
                            className="gap-2"
                            onClick={() => setDeleteDialogOpen(true)}
                            disabled={deleteTransactionMutation.isPending}
                        >
                            {deleteTransactionMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="h-4 w-4" />
                            )}
                            Delete Selected
                        </Button>
                    )}
                    <Button asChild variant="outline" className="gap-2">
                        <Link
                            to="/admin/bigquery-transactions"
                            search={{ page: 1, pageSize: 10 }}
                        >
                            <Database className="h-4 w-4" />
                            View Transactions
                        </Link>
                    </Button>
                </div>
            </div>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle>Delete Transaction</DialogTitle>
                        <DialogDescription>
                            {selectedTransaction
                                ? `Delete transaction ${selectedTransactionLabel}? This removes the Firestore transaction document and cannot be undone.`
                                : 'Select a transaction to delete.'}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setDeleteDialogOpen(false)}
                            disabled={deleteTransactionMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={!selectedTransaction || deleteTransactionMutation.isPending}
                            onClick={() => {
                                if (selectedTransactionId) {
                                    deleteTransactionMutation.mutate(selectedTransactionId)
                                }
                            }}
                        >
                            {deleteTransactionMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete Transaction'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="rounded-md bg-white">
                <Table>
                    <TableHeader>
                        <TableRow className="border-none hover:bg-transparent">
                            <TableHead className="w-16 font-bold text-black">Select</TableHead>
                            <TableHead className="font-bold text-black">Date</TableHead>
                            <TableHead className="font-bold text-black">Type/Offer</TableHead>
                            <TableHead className="font-bold text-black">User</TableHead>
                            <TableHead className="font-bold text-black">Vendor</TableHead>
                            <TableHead className="text-right font-bold text-black">Amount</TableHead>
                            <TableHead className="text-right font-bold text-black">Rewards/Benefits</TableHead>
                            <TableHead className="text-right font-bold text-black">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="py-10 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
                                        <p className="font-medium text-muted-foreground">
                                            Loading today's transactions...
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : error ? (
                            <TableRow>
                                <TableCell colSpan={8} className="py-10 text-center text-red-600">
                                    {error.message}
                                </TableCell>
                            </TableRow>
                        ) : transactionList.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                                    No transactions found today.
                                </TableCell>
                            </TableRow>
                        ) : (
                            transactionList.map((transaction) => (
                                <DailyTransactionRow
                                    key={transaction.id}
                                    transaction={transaction}
                                    selected={selectedTransactionId === transaction.id}
                                    selectionDisabled={deleteTransactionMutation.isPending}
                                    onSelect={(selected) => {
                                        setSelectedTransactionId(selected ? transaction.id : null)
                                    }}
                                    onOpen={() => {
                                        void navigate({
                                            to: '/admin/transactions/$id',
                                            params: { id: transaction.id },
                                        })
                                    }}
                                />
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

function DailyTransactionRow({
    transaction,
    selected,
    selectionDisabled,
    onSelect,
    onOpen,
}: {
    transaction: Transaction
    selected: boolean
    selectionDisabled: boolean
    onSelect: (selected: boolean) => void
    onOpen: () => void
}) {
    return (
        <TableRow
            className="h-20 cursor-pointer border-b border-gray-100 hover:bg-gray-50/50"
            onClick={onOpen}
        >
            <TableCell onClick={(event) => event.stopPropagation()}>
                <Checkbox
                    checked={selected}
                    disabled={selectionDisabled}
                    aria-label={`Select transaction ${transaction.transactionId}`}
                    onCheckedChange={(checked) => onSelect(checked === true)}
                />
            </TableCell>
            <TableCell>
                <div className="flex flex-col">
                    <span className="whitespace-nowrap font-medium">{transaction.date}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                        ID: {transaction.transactionId}
                    </span>
                </div>
            </TableCell>
            <TableCell>
                <div className="flex flex-col gap-1">
                    <Badge className="w-fit">
                        {transaction.type.replace(/_/g, ' ')}
                    </Badge>
                    {transaction.discountCode && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                            Code: {transaction.discountCode}
                        </span>
                    )}
                </div>
            </TableCell>
            <TableCell>
                {transaction.userId ? (
                    <Link
                        to="/admin/students/$studentId/settings"
                        params={{ studentId: transaction.userId }}
                        search={{ page: 1, pageSize: 10, search: '' }}
                        className="font-bold text-blue-600 hover:underline"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {transaction.userId.slice(0, 8)}...
                    </Link>
                ) : (
                    'N/A'
                )}
            </TableCell>
            <TableCell>
                {transaction.vendorId ? (
                    <Link
                        to="/admin/vendors/$vendorId/settings"
                        params={{ vendorId: transaction.vendorId }}
                        search={{ page: 1, pageSize: 10 }}
                        className="font-bold text-blue-600 hover:underline"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {transaction.vendorName}
                    </Link>
                ) : (
                    transaction.vendorName
                )}
            </TableCell>
            <TableCell className="text-right font-bold">
                {transaction.type === 'online_redemption'
                    ? 'Online'
                    : transaction.finalAmount !== undefined
                        ? `QAR ${transaction.finalAmount}`
                        : transaction.totalAmount}
            </TableCell>
            <TableCell className="text-right">
                {transaction.cashbackAmount ? (
                    <span className="font-bold text-green-600">
                        +QAR {transaction.cashbackAmount}
                    </span>
                ) : (
                    '-'
                )}
            </TableCell>
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                <Button variant="ghost" size="sm" onClick={onOpen}>
                    <Eye className="mr-2 h-4 w-4" />
                    Details
                </Button>
            </TableCell>
        </TableRow>
    )
}
