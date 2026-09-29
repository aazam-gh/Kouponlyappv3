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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Search, Upload, Plus, ChevronRight, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { db, functions } from '@/firebase/config'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { Switch } from '@/components/ui/switch'
import { fetchVendorsPage } from '@/lib/vendor-directory'
import type { Vendor } from '@/queries'
import { refreshVendorList } from '@/lib/vendorList'
import { resetFirestorePaginationCursors } from '@/lib/firestore-pagination'

export const Route = createLazyFileRoute('/admin/vendors/')({
    component: RouteComponent,
})

function RouteComponent() {
    const queryClient = useQueryClient()
    const navigate = useNavigate({ from: '/admin/vendors/' })
    const { page, pageSize, search: searchQuery, sort, xcard: xcardFilter } = useSearch({ from: '/admin/vendors/' })
    const [searchInput, setSearchInput] = useState(searchQuery)
    const [open, setOpen] = useState(false)
    const [form, setForm] = useState({ name: '', email: '', password: '' })
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [vendorToDelete, setVendorToDelete] = useState<Vendor | null>(null)

    useEffect(() => {
        setSearchInput(searchQuery)
    }, [searchQuery])

    const { data = { vendors: [], totalCount: 0 }, isLoading } = useQuery({
        queryKey: ['vendors-page', 'in_store', { page, pageSize, search: searchQuery, sort, xcard: xcardFilter }],
        queryFn: () => fetchVendorsPage({ page, pageSize, search: searchQuery, sort, xcard: xcardFilter }, 'in_store'),
        staleTime: 1000 * 60 * 5,
    })

    const totalVendors = data.totalCount
    const totalPages = Math.max(1, Math.ceil(totalVendors / pageSize))
    const effectivePage = Math.min(page, totalPages)
    const vendorList = data.vendors
    const hasNextPage = effectivePage < totalPages
    const hasPrevPage = effectivePage > 1

    const updateFilters = (updates: Record<string, string>) => {
        navigate({ search: (prev) => ({ ...prev, ...updates, page: 1 }) })
    }

    const submitSearch = () => {
        updateFilters({ search: searchInput.trim().toLowerCase() })
    }

    const addVendorMutation = useMutation({
        mutationFn: async (formData: typeof form) => {
            const createVendorUser = httpsCallable(functions, 'createVendorUser')
            const result = await createVendorUser({
                name: formData.name,
                email: formData.email,
                password: formData.password,
            })
            const dataResult = result.data as { uid: string }
            if (dataResult?.uid) {
                await setDoc(doc(db, 'vendors', dataResult.uid), { xcard: false, vendorType: 'in_store' }, { merge: true })
            }
            return result.data
        },
        onSuccess: () => {
            resetFirestorePaginationCursors('vendors:')
            queryClient.invalidateQueries({ queryKey: ['vendors-page'] })
            setForm({ name: '', email: '', password: '' })
            setOpen(false)
            void refreshVendorList()
        },
        onError: (error) => {
            console.error('Error adding vendor: ', error)
            alert('Failed to add vendor: ' + (error instanceof Error ? error.message : 'Unknown error'))
        }
    })

    const toggleXCardMutation = useMutation({
        mutationFn: async ({ vendorId, xcard }: { vendorId: string, xcard: boolean }) => {
            const vendorRef = doc(db, 'vendors', vendorId)
            await updateDoc(vendorRef, { xcard })
        },
        onSuccess: () => {
            resetFirestorePaginationCursors('vendors:')
            queryClient.invalidateQueries({ queryKey: ['vendors-page'] })
            void refreshVendorList()
        }
    })

    const deleteVendorMutation = useMutation({
        mutationFn: async (vendorId: string) => {
            const deleteVendorUser = httpsCallable(functions, 'deleteVendorUser')
            await deleteVendorUser({ uid: vendorId })
        },
        onSuccess: () => {
            resetFirestorePaginationCursors('vendors:')
            queryClient.invalidateQueries({ queryKey: ['vendors-page'] })
            setDeleteConfirmOpen(false)
            setVendorToDelete(null)
            void refreshVendorList()
        },
        onError: (error) => {
            console.error('Error deleting vendor: ', error)
            alert('Failed to delete vendor: ' + (error instanceof Error ? error.message : 'Unknown error'))
        }
    })

    const loading = isLoading

    const handleAddVendor = async () => {
        if (!form.name || !form.email || !form.password) return
        addVendorMutation.mutate(form)
    }

    const handleDeleteVendor = (vendor: Vendor) => {
        setVendorToDelete(vendor)
        setDeleteConfirmOpen(true)
    }

    const confirmDelete = () => {
        if (vendorToDelete) {
            deleteVendorMutation.mutate(vendorToDelete.id)
        }
    }

    return (
        <div className="p-8 space-y-6 w-full max-w-[1600px] mx-auto">
            <h1 className="text-3xl font-bold tracking-tight">Vendor Overview</h1>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Vendor</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{vendorToDelete?.name}</strong>? This action will remove the user's access and delete their data. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDelete}
                            disabled={deleteVendorMutation.isPending}
                        >
                            {deleteVendorMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete Vendor'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 w-full sm:max-w-lg">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by indexed keyword"
                            className="pl-9 bg-muted/50 border-none h-10"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') submitSearch()
                            }}
                        />
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        className="h-10"
                        onClick={submitSearch}
                    >
                        Search
                    </Button>
                    <Select value={xcardFilter} onValueChange={(v) => updateFilters({ xcard: v })}>
                        <SelectTrigger className="w-[150px] h-10 bg-muted/50 border-none">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Vendors</SelectItem>
                            <SelectItem value="enabled">XCard On</SelectItem>
                            <SelectItem value="disabled">XCard Off</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button variant="outline" className="gap-2 h-10">
                        Export <Upload className="h-4 w-4" />
                    </Button>
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-brand-green hover:bg-brand-green/90 text-white gap-2 h-10">
                                <Plus className="h-4 w-4" /> Add New Vendor
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Add New Vendor</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Vendor Name</Label>
                                    <Input
                                        id="name"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        placeholder="Enter vendor name"
                                        disabled={addVendorMutation.isPending}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        placeholder="Enter email address"
                                        disabled={addVendorMutation.isPending}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={form.password}
                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        placeholder="Enter password"
                                        disabled={addVendorMutation.isPending}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    className="bg-brand-green hover:bg-brand-green/90 text-white"
                                    onClick={handleAddVendor}
                                    disabled={addVendorMutation.isPending}
                                >
                                    {addVendorMutation.isPending ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Adding Vendor...
                                        </>
                                    ) : (
                                        'Add Vendor'
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Select value={sort} onValueChange={(v) => updateFilters({ sort: v })}>
                        <SelectTrigger className="w-[130px] h-10 bg-muted/50 border-none">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name-asc">A → Z</SelectItem>
                            <SelectItem value="name-desc">Z → A</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Results info */}
            {(searchQuery || xcardFilter !== 'all') && (
                <p className="text-sm text-muted-foreground">
                    {totalVendors} result{totalVendors !== 1 ? 's' : ''} found
                </p>
            )}

            <div className="rounded-md bg-white">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-none">
                            <TableHead className="w-12">
                                <Checkbox />
                            </TableHead>
                            <TableHead className="text-black font-bold text-base">Brand Name</TableHead>
                            <TableHead className="text-black font-bold text-base">Contact Info</TableHead>
                            <TableHead className="text-black font-bold text-base">XCard</TableHead>
                            <TableHead className="text-black font-bold text-base text-right pr-8">Actions:</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
                                        <p className="text-muted-foreground font-medium">Loading vendors...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : vendorList.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                    {searchQuery || xcardFilter !== 'all'
                                        ? 'No vendors match your filters.'
                                        : 'No vendors found.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            vendorList.map((vendor: Vendor) => (
                                <TableRow key={vendor.id} className="h-16 border-b border-gray-100 hover:bg-gray-50/50">
                                    <TableCell>
                                        <Checkbox />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            {vendor.profilePicture ? (
                                            <img src={vendor.profilePicture} alt={vendor.name || 'Vendor'} className="h-10 w-10 rounded-lg object-cover shrink-0" loading="lazy" />
                                            ) : (
                                                <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                                    <span className="text-gray-400 text-xs font-bold">{(vendor.name || 'V').charAt(0)}</span>
                                                </div>
                                            )}
                                            <span className="font-medium text-base">{vendor.name || 'Vendor'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium text-gray-900">{vendor.contact}</TableCell>
                                    <TableCell className="font-medium text-gray-900">
                                        <Switch
                                            checked={vendor.xcard}
                                            onCheckedChange={(checked) => toggleXCardMutation.mutate({ vendorId: vendor.id, xcard: checked })}
                                            disabled={toggleXCardMutation.isPending}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link to="/admin/vendors/$vendorId/settings" params={{ vendorId: vendor.id }}>
                                                <Button variant="outline" size="sm" className="rounded-full h-8 px-4 gap-1 text-xs font-semibold">
                                                    Manage <ChevronRight className="h-3 w-3" />
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                                                onClick={() => handleDeleteVendor(vendor)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
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
                        from="/admin/vendors/"
                        search={(prev) => ({
                            ...prev,
                            page: Math.max(1, (prev.page ?? 1) - 1),
                        })}
                        disabled={!hasPrevPage}
                        className={!hasPrevPage ? 'pointer-events-none opacity-50' : ''}
                    >
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 w-auto px-4 gap-2 text-sm font-medium"
                            disabled={!hasPrevPage}
                        >
                            ‹ Previous
                        </Button>
                    </Link>

                    <div className="text-sm font-medium text-muted-foreground">
                        Page {effectivePage} of {totalPages}
                    </div>

                    <Link
                        from="/admin/vendors/"
                        search={(prev) => ({
                            ...prev,
                            page: (prev.page ?? 1) + 1,
                        })}
                        disabled={!hasNextPage}
                        className={!hasNextPage ? 'pointer-events-none opacity-50' : ''}
                    >
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 w-auto px-4 gap-2 text-sm font-medium"
                            disabled={!hasNextPage}
                        >
                            Next ›
                        </Button>
                    </Link>
                </div>
            )}
        </div>
    )
}
