import { createLazyFileRoute, Link, useSearch, useNavigate } from '@tanstack/react-router'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Eye, Loader2, CheckCircle2, XCircle, Copy, Check, Trash2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { db, functions, storage } from '@/firebase/config'
import { collection, query, orderBy, getCountFromServer, where, type QueryConstraint } from 'firebase/firestore'
import { ref, getDownloadURL } from 'firebase/storage'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { logAdminRead } from '@/lib/admin-read-logging'
import { getCursorPage, resetFirestorePaginationCursors } from '@/lib/firestore-pagination'

export const Route = createLazyFileRoute('/admin/verification-requests/')({
    component: RouteComponent,
})

interface VerificationRequest {
    id: string
    authUid: string | null
    email: string
    idImagePath: string
    rejectionReason: string | null
    reviewedAt: any
    reviewedBy: string | null
    role: string
    status: "pending" | "approved" | "rejected"
    submittedAt: any
}

function RouteComponent() {
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const { page, pageSize, status: statusFilter } = useSearch({ from: '/admin/verification-requests/' })

    const [detailOpen, setDetailOpen] = useState(false)
    const [approveOpen, setApproveOpen] = useState(false)
    const [rejectOpen, setRejectOpen] = useState(false)
    const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null)
    const [idImageUrl, setIdImageUrl] = useState<string | null>(null)
    const [rejectionReason, setRejectionReason] = useState('')
    const [approveForm, setApproveForm] = useState({
        firstName: '',
        lastName: '',
        gender: 'Unspecified',
        dob: '',
        role: 'student',
        studentId: '',
    })
    const [creatorCodeResult, setCreatorCodeResult] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)

    const { data, isLoading } = useQuery({
        queryKey: ['verification-requests', page, pageSize, statusFilter],
        queryFn: async () => {
            const collRef = collection(db, 'verification_requests')
            const constraints: QueryConstraint[] = []
            const countConstraints: QueryConstraint[] = []

            if (statusFilter && statusFilter !== 'all') {
                const statusConstraint = where('status', '==', statusFilter)
                constraints.push(statusConstraint)
                countConstraints.push(statusConstraint)
            }

            constraints.push(orderBy('submittedAt', 'desc'))

            const countQuery = countConstraints.length
                ? query(collRef, ...countConstraints)
                : collRef
            const countSnapshot = await getCountFromServer(countQuery)
            const totalCount = countSnapshot.data().count

            const pageResult = await getCursorPage(
                collRef,
                constraints,
                page,
                pageSize,
                `verification-requests:${statusFilter}`,
            )

            const requests = pageResult.docs.map(docSnap => {
                const d = docSnap.data()
                return {
                    id: docSnap.id,
                    authUid: d.authUid || null,
                    email: d.email || '',
                    idImagePath: d.idImagePath || '',
                    rejectionReason: d.rejectionReason || null,
                    reviewedAt: d.reviewedAt || null,
                    reviewedBy: d.reviewedBy || null,
                    role: d.role || 'student',
                    status: d.status || 'pending',
                    submittedAt: d.submittedAt || null,
                } as VerificationRequest
            })

            logAdminRead('verification-requests-page', {
                page,
                pageSize,
                docsFetched: pageResult.docsFetched,
                docsDisplayed: requests.length,
                totalCount,
                status: statusFilter,
            })

            return { requests, totalCount }
        },
        staleTime: 1000 * 60 * 5,
    })

    // Fetch ID images when detail dialog opens
    useEffect(() => {
        if (detailOpen && selectedRequest) {
            setIdImageUrl(null)
            if (selectedRequest.idImagePath) {
                getDownloadURL(ref(storage, selectedRequest.idImagePath))
                    .then(setIdImageUrl)
                    .catch(() => setIdImageUrl(null))
            }
        }
    }, [detailOpen, selectedRequest])

    const approveMutation = useMutation({
        mutationFn: async () => {
            if (!selectedRequest) return
            const approve = httpsCallable(functions, 'approveVerificationRequest')
            const result = await approve({
                verificationRequestId: selectedRequest.id,
                firstName: approveForm.firstName,
                lastName: approveForm.lastName,
                gender: approveForm.gender,
                dob: approveForm.dob,
                role: approveForm.role,
                studentId: approveForm.studentId,
            })
            return result.data as any
        },
        onSuccess: (data) => {
            resetFirestorePaginationCursors('verification-requests:')
            queryClient.invalidateQueries({ queryKey: ['verification-requests'] })
            if (data?.creatorCode) {
                setCreatorCodeResult(data.creatorCode)
                setApproveOpen(true)
                setDetailOpen(false)
            } else {
                setApproveOpen(false)
                setDetailOpen(false)
            }
            setApproveForm({ firstName: '', lastName: '', gender: 'Unspecified', dob: '', role: 'student', studentId: '' })
        },
        onError: (error) => {
            alert('Failed to approve request: ' + (error instanceof Error ? error.message : 'Unknown error'))
        },
    })

    const rejectMutation = useMutation({
        mutationFn: async () => {
            if (!selectedRequest) return
            const reject = httpsCallable(functions, 'rejectVerificationRequest')
            const result = await reject({
                verificationRequestId: selectedRequest.id,
                rejectionReason,
            })
            return result.data
        },
        onSuccess: () => {
            resetFirestorePaginationCursors('verification-requests:')
            queryClient.invalidateQueries({ queryKey: ['verification-requests'] })
            setRejectOpen(false)
            setDetailOpen(false)
            setRejectionReason('')
        },
        onError: (error) => {
            alert('Failed to reject request: ' + (error instanceof Error ? error.message : 'Unknown error'))
        },
    })

    const deleteMutation = useMutation({
        mutationFn: async () => {
            if (!selectedRequest) return
            const deleteFn = httpsCallable(functions, 'deleteVerificationRequest')
            const result = await deleteFn({
                verificationRequestId: selectedRequest.id,
            })
            return result.data
        },
        onSuccess: () => {
            resetFirestorePaginationCursors('verification-requests:')
            queryClient.invalidateQueries({ queryKey: ['verification-requests'] })
            setDeleteOpen(false)
            setDetailOpen(false)
        },
        onError: (error) => {
            alert('Failed to delete request: ' + (error instanceof Error ? error.message : 'Unknown error'))
        },
    })

    const handleView = (request: VerificationRequest) => {
        setSelectedRequest(request)
        setDetailOpen(true)
    }

    const handleRejectClick = () => {
        setDetailOpen(false)
        setRejectOpen(true)
    }

    const handleDeleteClick = () => {
        setDetailOpen(false)
        setDeleteOpen(true)
    }

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '—'
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    const statusBadge = (status: string) => {
        const variants: Record<string, string> = {
            pending: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
            approved: 'bg-green-100 text-green-800 hover:bg-green-100',
            rejected: 'bg-red-100 text-red-800 hover:bg-red-100',
        }
        return (
            <Badge className={`${variants[status] || ''} capitalize`}>
                {status}
            </Badge>
        )
    }

    const requestList = data?.requests || []
    const totalCount = data?.totalCount || 0
    const hasNextPage = page * pageSize < totalCount
    const hasPrevPage = page > 1

    return (
        <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
            <div className="space-y-6">
                <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Verification Requests</h1>

                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                    <div className="text-sm text-muted-foreground">
                        {totalCount} total request{totalCount !== 1 ? 's' : ''}
                    </div>
                    <div className="flex w-full items-center gap-2 sm:w-auto">
                        <Select
                            value={statusFilter}
                            onValueChange={(value) => {
                                navigate({
                                    to: '/admin/verification-requests' as any,
                                    search: (prev: any) => ({ ...prev, page: 1, status: value }),
                                } as any)
                            }}
                        >
                            <SelectTrigger className="h-10 w-[180px] border-none bg-muted/50">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Table */}
                <div className="rounded-md border border-border bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b border-border hover:bg-transparent">
                                <TableHead className="w-12">
                                    <Checkbox />
                                </TableHead>
                                <TableHead className="text-base font-bold text-foreground">Email</TableHead>
                                <TableHead className="text-base font-bold text-foreground">Role</TableHead>
                                <TableHead className="text-base font-bold text-foreground">Status</TableHead>
                                <TableHead className="text-base font-bold text-foreground">Submitted At</TableHead>
                                <TableHead className="pr-8 text-right text-base font-bold text-foreground">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="py-10 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
                                            <p className="font-medium text-muted-foreground">Loading requests...</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : requestList.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                                        No verification requests found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                requestList.map((request) => (
                                    <TableRow key={request.id} className="h-16 border-b border-border hover:bg-muted/50">
                                        <TableCell>
                                            <Checkbox />
                                        </TableCell>
                                        <TableCell className="font-medium text-foreground">{request.email}</TableCell>
                                        <TableCell className="capitalize">{request.role}</TableCell>
                                        <TableCell>{statusBadge(request.status)}</TableCell>
                                        <TableCell className="text-muted-foreground">{formatDate(request.submittedAt)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 gap-1 rounded-full px-4 text-xs font-semibold"
                                                onClick={() => handleView(request)}
                                            >
                                                <Eye className="h-3 w-3" /> View
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {(hasPrevPage || hasNextPage) && (
                    <div className="flex items-center justify-center gap-4 pt-4">
                        <Link
                            from="/admin/verification-requests/"
                            search={(prev: any) => ({
                                ...prev,
                                page: Math.max(1, page - 1),
                            })}
                            disabled={!hasPrevPage}
                            className={!hasPrevPage ? 'pointer-events-none opacity-50' : ''}
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-10 w-auto gap-2 px-4 text-sm font-medium"
                                disabled={!hasPrevPage}
                            >
                                Previous
                            </Button>
                        </Link>

                        <div className="text-sm font-medium text-muted-foreground">
                            Page {page}
                        </div>

                        <Link
                            from="/admin/verification-requests/"
                            search={(prev: any) => ({
                                ...prev,
                                page: page + 1,
                            })}
                            disabled={!hasNextPage}
                            className={!hasNextPage ? 'pointer-events-none opacity-50' : ''}
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-10 w-auto gap-2 px-4 text-sm font-medium"
                                disabled={!hasNextPage}
                            >
                                Next
                            </Button>
                        </Link>
                    </div>
                )}
            </div>

            {/* Detail Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle>Verification Request Details</DialogTitle>
                    </DialogHeader>
                    {selectedRequest && (
                        <div className="space-y-4 py-2">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <p className="text-sm text-muted-foreground">Email</p>
                                    <p className="font-medium">{selectedRequest.email}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Status</p>
                                    {statusBadge(selectedRequest.status)}
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Role</p>
                                    <p className="font-medium capitalize">{selectedRequest.role}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Submitted At</p>
                                    <p className="font-medium">{formatDate(selectedRequest.submittedAt)}</p>
                                </div>
                                {selectedRequest.reviewedAt && (
                                    <div>
                                        <p className="text-sm text-muted-foreground">Reviewed At</p>
                                        <p className="font-medium">{formatDate(selectedRequest.reviewedAt)}</p>
                                    </div>
                                )}
                                {selectedRequest.rejectionReason && (
                                    <div className="col-span-2">
                                        <p className="text-sm text-muted-foreground">Rejection Reason</p>
                                        <p className="font-medium text-red-600">{selectedRequest.rejectionReason}</p>
                                    </div>
                                )}
                            </div>

                            {/* ID Images */}
                            <div>
                                <p className="text-sm text-muted-foreground mb-2">ID Documents</p>
                                <div className="rounded-lg border bg-muted/30 overflow-hidden">
                                    <p className="text-xs text-muted-foreground p-2 border-b">Uploaded ID</p>
                                    {idImageUrl ? (
                                        <img src={idImageUrl} alt="Uploaded ID" className="w-full h-64 object-cover" />
                                    ) : (
                                        <div className="w-full h-64 flex items-center justify-center">
                                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Approval form for pending requests */}
                            {selectedRequest.status === 'pending' && (
                                <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                                    <div>
                                        <p className="text-sm font-medium">Account Details</p>
                                        <p className="text-sm text-muted-foreground">
                                            Review the uploaded ID above, then enter the account details before approving.
                                        </p>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label htmlFor="detail-approve-firstName">First Name</Label>
                                            <Input
                                                id="detail-approve-firstName"
                                                value={approveForm.firstName}
                                                onChange={(e) => setApproveForm({ ...approveForm, firstName: e.target.value })}
                                                placeholder="Student"
                                                disabled={approveMutation.isPending}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="detail-approve-lastName">Last Name</Label>
                                            <Input
                                                id="detail-approve-lastName"
                                                value={approveForm.lastName}
                                                onChange={(e) => setApproveForm({ ...approveForm, lastName: e.target.value })}
                                                placeholder="Doe"
                                                disabled={approveMutation.isPending}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Email Address</Label>
                                        <Input
                                            value={selectedRequest.email || ''}
                                            disabled
                                            className="bg-muted"
                                        />
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label htmlFor="detail-approve-gender">Gender</Label>
                                            <Select
                                                value={approveForm.gender}
                                                onValueChange={(value) => setApproveForm({ ...approveForm, gender: value })}
                                            >
                                                <SelectTrigger id="detail-approve-gender" disabled={approveMutation.isPending}>
                                                    <SelectValue placeholder="Select gender" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Male">Male</SelectItem>
                                                    <SelectItem value="Female">Female</SelectItem>
                                                    <SelectItem value="Unspecified">Unspecified</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="detail-approve-dob">Date of Birth</Label>
                                            <Input
                                                id="detail-approve-dob"
                                                type="date"
                                                value={approveForm.dob}
                                                onChange={(e) => setApproveForm({ ...approveForm, dob: e.target.value })}
                                                disabled={approveMutation.isPending}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="detail-approve-role">Role</Label>
                                        <Select
                                            value={approveForm.role}
                                            onValueChange={(value) => setApproveForm({ ...approveForm, role: value })}
                                        >
                                            <SelectTrigger id="detail-approve-role" disabled={approveMutation.isPending}>
                                                <SelectValue placeholder="Select role" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="student">Student</SelectItem>
                                                <SelectItem value="creator">Creator</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="detail-approve-studentId">Student ID</Label>
                                        <Input
                                            id="detail-approve-studentId"
                                            value={approveForm.studentId}
                                            onChange={(e) => setApproveForm({ ...approveForm, studentId: e.target.value })}
                                            placeholder="e.g. STU-2024-001"
                                            disabled={approveMutation.isPending}
                                        />
                                    </div>
                                    {approveForm.role === 'creator' && (
                                        <div className="rounded-lg border border-brand-green/30 bg-brand-green/5 p-3">
                                            <p className="text-sm text-muted-foreground">
                                                A unique 4-character creator code will be automatically generated for this account upon creation.
                                            </p>
                                        </div>
                                    )}
                                    <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                                        <Button
                                            variant="outline"
                                            className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                                            onClick={handleRejectClick}
                                        >
                                            <XCircle className="h-4 w-4 mr-2" />
                                            Reject
                                        </Button>
                                        <Button
                                            className="flex-1 bg-brand-green hover:bg-brand-green/90 text-white"
                                            onClick={() => approveMutation.mutate()}
                                            disabled={approveMutation.isPending}
                                        >
                                            {approveMutation.isPending ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Creating Account...
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                                    Approve & Create Account
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Delete button for reviewed requests */}
                            {selectedRequest.status !== 'pending' && (
                                <div className="flex pt-2">
                                    <Button
                                        variant="outline"
                                        className="text-red-600 border-red-200 hover:bg-red-50"
                                        onClick={handleDeleteClick}
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete Verification Data
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Approve Dialog */}
            <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
                <DialogContent className="sm:max-w-[550px]">
                    <DialogHeader>
                        <DialogTitle>Creator Account Created</DialogTitle>
                    </DialogHeader>
                    {creatorCodeResult ? (
                        <div className="py-4 space-y-4">
                            <div className="flex items-center gap-2 text-green-600 font-medium">
                                <CheckCircle2 className="h-5 w-5" />
                                <span>Creator account created successfully!</span>
                            </div>
                            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                                <p className="text-sm text-muted-foreground">Generated Creator Code:</p>
                                <div className="flex items-center gap-3">
                                    <code className="text-2xl font-mono font-bold tracking-widest">{creatorCodeResult}</code>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-2"
                                        onClick={() => {
                                            navigator.clipboard.writeText(creatorCodeResult)
                                            setCopied(true)
                                            setTimeout(() => setCopied(false), 2000)
                                        }}
                                    >
                                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                            <Button
                                className="w-full bg-brand-green hover:bg-brand-green/90 text-white"
                                onClick={() => {
                                    setCreatorCodeResult(null)
                                    setCopied(false)
                                    setApproveOpen(false)
                                }}
                            >
                                Done
                            </Button>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Reject Verification Request</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <p className="text-sm text-muted-foreground">
                            Rejecting request from <strong>{selectedRequest?.email}</strong>
                        </p>
                        <div className="grid gap-2">
                            <Label htmlFor="rejection-reason">Rejection Reason *</Label>
                            <Textarea
                                id="rejection-reason"
                                placeholder="Please provide a reason for rejecting this request..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                disabled={rejectMutation.isPending}
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => rejectMutation.mutate()}
                            disabled={rejectMutation.isPending || !rejectionReason.trim()}
                        >
                            {rejectMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Rejecting...
                                </>
                            ) : (
                                'Reject Request'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Delete Verification Data</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <p className="text-sm text-muted-foreground">
                            Are you sure you want to permanently delete the verification request from <strong>{selectedRequest?.email}</strong>?
                        </p>
                        <p className="text-sm text-muted-foreground">
                            This will remove the Firestore document and all associated ID images from storage. This action cannot be undone.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteMutation.mutate()}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
