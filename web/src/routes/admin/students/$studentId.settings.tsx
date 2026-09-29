import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { db, functions } from '@/firebase/config'
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, getCountFromServer } from 'firebase/firestore'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { ArrowLeft, CheckCircle2, XCircle, Tag, Wallet, History, AlertCircle, ShoppingBag, Trash2, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { format } from 'date-fns'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { useState } from 'react'
import { STALE_TIME } from '@/lib/constants'
import { logAdminRead } from '@/lib/admin-read-logging'
import { getCursorPage, resetFirestorePaginationCursors } from '@/lib/firestore-pagination'

export interface Student {
    id: string
    firstName?: string
    lastName?: string
    name?: string
    email?: string
    phoneNumber?: string
    isVerified?: boolean
    creatorCode?: string
    profilePicture?: string
    amountSaved?: number
    cashback?: number
    savings?: number
    dob?: string
    gender?: string
    role?: string
    uid?: string
    createdAt?: any
    updatedAt?: any
    university?: string
    campus?: string
    interests?: string[]
}

export interface Redemption {
    id: string
    offerId: string
    offerTitle: string
    vendorId: string
    vendorName: string
    studentId: string
    discountAmount: number
    discountType: string
    originalPrice?: number
    createdAt: any
}

export interface SavedItem {
    id: string
    type?: 'vendor' | 'offer' | 'event'
    sourceId?: string
    title?: string
    subtitle?: string
    vendorId?: string
    routePath?: string
    externalUrl?: string
    savedAt?: string
}

const studentSettingsSearchSchema = z.object({
    page: z.number().catch(1),
    pageSize: z.number().catch(10),
    search: z.string().catch(''),
})

export const Route = createFileRoute('/admin/students/$studentId/settings')({
    validateSearch: (search) => studentSettingsSearchSchema.parse(search),
    loaderDeps: ({ search: { page, pageSize } }) => ({ page, pageSize }),
    component: StudentSettings,
    loader: async ({ context: { queryClient }, params: { studentId } }) => {
        await queryClient.ensureQueryData({
            queryKey: ['student', studentId],
            queryFn: async () => {
                const docRef = doc(db, 'students', studentId)
                const snapshot = await getDoc(docRef)
                if (!snapshot.exists()) {
                    throw new Error('Student not found')
                }
                const data = snapshot.data()
                return {
                    id: snapshot.id,
                    ...data,
                    name: (data.firstName || data.lastName) ? `${data.firstName || ''} ${data.lastName || ''}`.trim() : (data.name || 'Unnamed Student'),
                    amountSaved: data.amountSaved || 0,
                } as Student
            },
        })
    },
})

function StudentSettings() {
    const { studentId } = Route.useParams()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [deleteOpen, setDeleteOpen] = useState(false)

    const { data: student, isLoading: isStudentLoading, isError: isStudentError } = useQuery({
        queryKey: ['student', studentId],
        initialData: () => queryClient.getQueryData<Student>(['student', studentId]),
        staleTime: STALE_TIME.MEDIUM,
        queryFn: async () => {
            const docRef = doc(db, 'students', studentId)
            const snapshot = await getDoc(docRef)
            if (!snapshot.exists()) {
                throw new Error('Student not found')
            }
            const data = snapshot.data()
            return {
                id: snapshot.id,
                ...data,
                name: (data.firstName || data.lastName) ? `${data.firstName || ''} ${data.lastName || ''}`.trim() : (data.name || 'Unnamed Student'),
                amountSaved: data.amountSaved || 0,
            } as Student
        }
    })

    const { page, pageSize } = Route.useSearch()

    const { data: { transactions: redemptions = [], totalCount = 0 } = {}, isLoading: isRedemptionsLoading } = useQuery({
        queryKey: ['student-redemptions', studentId, page, pageSize],
        queryFn: async () => {
            const collRef = collection(db, 'transactions')
            const qCount = query(
                collRef,
                where('userId', '==', studentId)
            )
            const countSnapshot = await getCountFromServer(qCount)
            const totalCount = countSnapshot.data().count

            const pageResult = await getCursorPage(
                collRef,
                [where('userId', '==', studentId), orderBy('createdAt', 'desc')],
                page,
                pageSize,
                `student-redemptions:${studentId}`,
            )
            const transactions = pageResult.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Redemption[]

            logAdminRead('student-redemptions-page', {
                studentId,
                page,
                pageSize,
                docsFetched: pageResult.docsFetched,
                docsDisplayed: transactions.length,
                totalCount,
            })

            return { transactions, totalCount }
        }
    })

    const { data: savedItems = [], isLoading: isSavedItemsLoading } = useQuery({
        queryKey: ['student-saved-items', studentId],
        queryFn: async () => {
            const savedItemsRef = collection(db, 'students', studentId, 'savedItems')
            const savedItemsQuery = query(savedItemsRef, limit(50))
            const snapshot = await getDocs(savedItemsQuery)

            return snapshot.docs
                .map((docSnap) => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                })) as SavedItem[]
        },
    })

    const sortedSavedItems = [...savedItems].sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''))

    const deleteStudentMutation = useMutation({
        mutationFn: async () => {
            const deleteStudentUser = httpsCallable(functions, 'deleteStudentUser')
            await deleteStudentUser({ uid: student?.uid || studentId })
        },
        onSuccess: () => {
            resetFirestorePaginationCursors('students:')
            resetFirestorePaginationCursors(`student-redemptions:${studentId}`)
            queryClient.invalidateQueries({ queryKey: ['students'] })
            navigate({ to: '/admin/students', search: { page: 1, pageSize: 10, search: '' } })
        },
        onError: (error) => {
            console.error('Error deleting student: ', error)
            alert('Failed to delete student: ' + (error instanceof Error ? error.message : 'Unknown error'))
            setDeleteOpen(false)
        }
    })

    if (isStudentLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
                    <p className="text-muted-foreground font-medium">Loading student data...</p>
                </div>
            </div>
        )
    }

    if (isStudentError || !student) {
        return (
            <div className="p-8 flex flex-col items-center justify-center min-h-[400px] gap-4">
                <AlertCircle className="h-12 w-12 text-red-500" />
                <h2 className="text-xl font-bold">Student Not Found</h2>
                <p className="text-muted-foreground">The student you are looking for does not exist or has been deleted.</p>
                <button
                    onClick={() => navigate({ to: '/admin/students', search: { page: 1, pageSize: 10, search: '' } })}
                    className="mt-4 px-4 py-2 bg-brand-green text-white rounded-md font-medium"
                >
                    Back to Students
                </button>
            </div>
        )
    }

    const formatTimestamp = (timestamp: any) => {
        if (!timestamp) return 'N/A'
        if (timestamp.toDate) return format(timestamp.toDate(), 'MMMM d, yyyy h:mm:ss a')
        return format(new Date(timestamp), 'MMMM d, yyyy h:mm:ss a')
    }

    return (
        <div className="p-8 space-y-8 w-full max-w-[1200px] mx-auto animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    to="/admin/students"
                    search={{ page: 1, pageSize: 10, search: '' }}
                    className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors group"
                >
                    <ArrowLeft className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        {student.profilePicture ? (
                            <img src={student.profilePicture} alt={student.name} className="h-10 w-10 rounded-full object-cover shrink-0 border border-border" />
                        ) : (
                            <div className="h-10 w-10 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center shrink-0 border border-brand-green/20">
                                <span className="font-bold text-lg">{student.name?.charAt(0) || '?'}</span>
                            </div>
                        )}
                        <span>{student.name}</span>
                    </h1>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Info Card */}
                <Card className="md:col-span-1 shadow-sm border-border/50">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Tag className="h-5 w-5 text-muted-foreground" />
                            Student Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">First Name</p>
                                <p className="font-medium text-foreground">{student.firstName || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Last Name</p>
                                <p className="font-medium text-foreground">{student.lastName || 'N/A'}</p>
                            </div>
                        </div>

                        <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Email</p>
                            <p className="font-medium text-foreground">{student.email || 'N/A'}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Gender</p>
                                <p className="font-medium text-foreground">{student.gender || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Date of Birth</p>
                                <p className="font-medium text-foreground">{student.dob || 'N/A'}</p>
                            </div>
                        </div>

                        <div className="pt-2 border-t space-y-3">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">University</p>
                                <p className="font-medium text-foreground">{student.university || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Campus</p>
                                <p className="font-medium text-foreground">{student.campus || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Interests</p>
                                {student.interests?.length ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {student.interests.map((interest) => (
                                            <span
                                                key={interest}
                                                className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                                            >
                                                {interest}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="font-medium text-foreground">N/A</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Role</p>
                                <p className="font-medium text-foreground capitalize">{student.role || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Creator Code</p>
                                <div className="font-mono font-medium text-foreground tracking-widest bg-muted/50 px-2 py-0.5 rounded text-sm inline-block">
                                    {student.creatorCode || '----'}
                                </div>
                            </div>
                        </div>

                        <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                            <div className="flex items-center gap-2">
                                {student.isVerified ? (
                                    <div className="flex items-center gap-1.5 text-green-600 font-medium bg-green-50 px-2.5 py-1 rounded-full text-sm">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span>Verified</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 text-red-500 font-medium bg-red-50 px-2.5 py-1 rounded-full text-sm">
                                        <XCircle className="h-4 w-4" />
                                        <span>Unverified</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Savings</p>
                                <div className="flex items-center gap-2 text-lg font-bold text-brand-green">
                                    <Wallet className="h-4 w-4" />
                                    ${(student.savings ?? student.amountSaved ?? 0).toFixed(2)}
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Cashback</p>
                                <div className="flex items-center gap-2 text-lg font-bold text-blue-600">
                                    <ShoppingBag className="h-4 w-4" />
                                    ${(student.cashback || 0).toFixed(2)}
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 border-t space-y-3">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-0.5">UID</p>
                                <p className="text-xs font-mono text-muted-foreground break-all bg-muted/30 p-2 rounded">
                                    {student.uid || student.id}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-0.5">Created At</p>
                                <p className="text-xs text-foreground font-medium">
                                    {formatTimestamp(student.createdAt)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-0.5">Updated At</p>
                                <p className="text-xs text-foreground font-medium">
                                    {formatTimestamp(student.updatedAt)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                    <div className="px-6 pb-6 pt-2 border-t">
                        <Button
                            variant="destructive"
                            className="w-full gap-2"
                            onClick={() => setDeleteOpen(true)}
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete Student
                        </Button>
                    </div>
                    <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Delete Student</DialogTitle>
                            </DialogHeader>
                            <p className="text-muted-foreground">
                                Are you sure you want to delete <strong>{student.name}</strong>? This will permanently remove their account, all Firestore data, and transaction history. This action cannot be undone.
                            </p>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteStudentMutation.isPending}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => deleteStudentMutation.mutate()}
                                    disabled={deleteStudentMutation.isPending}
                                >
                                    {deleteStudentMutation.isPending ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Deleting...
                                        </>
                                    ) : (
                                        'Delete'
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </Card>

                {/* Redemptions List */}
                <Card className="md:col-span-2 shadow-sm border-border/50 flex flex-col h-full min-h-[400px]">
                    <CardHeader className="pb-4 border-b">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <History className="h-5 w-5 text-muted-foreground" />
                                Redemption History
                            </CardTitle>
                            <div className="text-sm font-medium text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                                {totalCount} total
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-auto">
                        <Table>
                            <TableHeader className="bg-muted/30 sticky top-0">
                                <TableRow>
                                    <TableHead>Vendor</TableHead>
                                    <TableHead>Offer</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Saved</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isRedemptionsLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-10">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green border-t-transparent" />
                                                <p className="text-muted-foreground font-medium text-sm">Loading history...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : redemptions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-48 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2">
                                                <ShoppingBag className="h-8 w-8 opacity-20" />
                                                <p>No redemptions found</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    redemptions.map((redemption) => (
                                        <TableRow key={redemption.id} className="hover:bg-muted/50">
                                            <TableCell className="font-medium text-foreground">
                                                {redemption.vendorName || 'Unknown Vendor'}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {redemption.offerTitle || 'Unknown Offer'}
                                                {redemption.discountType === 'buy1get1'
                                                    ? ' (Buy 1 Get 1)'
                                                    : redemption.discountType === 'percentage'
                                                      ? ` (${redemption.discountAmount}%)`
                                                      : ` ($${redemption.discountAmount})`
                                                }
                                            </TableCell>
                                            <TableCell>
                                                {redemption.createdAt?.toDate
                                                    ? format(redemption.createdAt.toDate(), 'MMM d, yyyy h:mm a')
                                                    : 'Unknown Date'}
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-brand-green">
                                                {redemption.discountType === 'percentage' && redemption.originalPrice
                                                    ? `$${((redemption.originalPrice * redemption.discountAmount) / 100).toFixed(2)}`
                                                    : redemption.discountType === 'amount'
                                                        ? `$${redemption.discountAmount?.toFixed(2)}`
                                                        : redemption.discountType === 'buy1get1'
                                                          ? 'Buy 1 Get 1'
                                                          : '-'
                                                }
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                    {/* Pagination Controls */}
                    <div className="p-4 border-t flex items-center justify-between">
                        <div className="text-sm text-muted-foreground font-medium">
                            Showing <span className="text-foreground">{Math.min(redemptions.length, pageSize)}</span> of <span className="text-foreground">{totalCount}</span> results
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate({ to: '.', search: (prev: any) => ({ ...prev, page: Math.max(1, (prev.page || 1) - 1) }) })}
                                disabled={page === 1 || isRedemptionsLoading}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="text-sm font-bold bg-muted px-3 py-1 rounded-md min-w-[32px] text-center">
                                {page}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate({ to: '.', search: (prev: any) => ({ ...prev, page: (prev.page || 1) + 1 }) })}
                                disabled={page * pageSize >= totalCount || isRedemptionsLoading}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            <Card className="shadow-sm border-border/50">
                <CardHeader className="pb-4 border-b">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Tag className="h-5 w-5 text-muted-foreground" />
                            Saved Items
                        </CardTitle>
                        <div className="text-sm font-medium text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                            {sortedSavedItems.length} total
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 overflow-auto">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead>Type</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead>Vendor</TableHead>
                                <TableHead>Route / URL</TableHead>
                                <TableHead>Saved</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isSavedItemsLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-green border-t-transparent" />
                                            <p className="text-muted-foreground font-medium text-sm">Loading saved items...</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : sortedSavedItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-36 text-center">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2">
                                            <Tag className="h-8 w-8 opacity-20" />
                                            <p>No saved items found</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedSavedItems.map((item) => (
                                    <TableRow key={item.id} className="hover:bg-muted/50">
                                        <TableCell>
                                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold capitalize text-muted-foreground">
                                                {item.type || 'unknown'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-medium text-foreground">
                                            <div className="space-y-0.5">
                                                <p>{item.title || 'Untitled'}</p>
                                                {item.subtitle && (
                                                    <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {item.sourceId || item.id}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {item.vendorId || '-'}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {item.externalUrl ? (
                                                <a href={item.externalUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                                                    External URL
                                                </a>
                                            ) : (
                                                item.routePath || '-'
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {item.savedAt ? format(new Date(item.savedAt), 'MMM d, yyyy h:mm a') : 'Unknown'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
