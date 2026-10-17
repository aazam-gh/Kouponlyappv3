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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Search, Plus, ChevronRight, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
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
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { invokeAdminAction } from '@/lib/admin-actions'
import { fetchAllVendors, fetchVendorsPage } from '@/lib/vendor-directory'
import { categoriesQueryOptions, type Vendor } from '@/queries'

export const Route = createLazyFileRoute('/admin/vendors/')({
    component: RouteComponent,
})

function RouteComponent() {
    const queryClient = useQueryClient()
    const navigate = useNavigate({ from: '/admin/vendors/' })
    const { page, pageSize, search: searchQuery, sort } = useSearch({ from: '/admin/vendors/' })
    const [searchInput, setSearchInput] = useState(searchQuery)
    const [open, setOpen] = useState(false)
    const [form, setForm] = useState({ name: '', email: '', password: '', categoryIds: [] as string[] })
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [vendorToDelete, setVendorToDelete] = useState<Vendor | null>(null)
    const [exporting, setExporting] = useState(false)

    useEffect(() => {
        setSearchInput(searchQuery)
    }, [searchQuery])

    const { data = { vendors: [], totalCount: 0 }, isLoading, isError, error, refetch } = useQuery({
        queryKey: ['vendors-page', 'in_store', { page, pageSize, search: searchQuery, sort }],
        queryFn: () => fetchVendorsPage({ page, pageSize, search: searchQuery, sort }, 'in_store'),
        staleTime: 1000 * 60 * 5,
    })

    const { data: categories = [] } = useQuery(categoriesQueryOptions())

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
            return invokeAdminAction('createVendorUser', {
                name: formData.name,
                email: formData.email,
                password: formData.password,
                categoryId: formData.categoryIds[0],
                categoryIds: formData.categoryIds,
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendors-page'] })
            setForm({ name: '', email: '', password: '', categoryIds: [] })
            setOpen(false)
        },
        onError: (error) => {
            console.error('Error adding vendor: ', error)
            alert('Failed to add vendor: ' + (error instanceof Error ? error.message : 'Unknown error'))
        }
    })

    const deleteVendorMutation = useMutation({
        mutationFn: async (vendorId: string) => {
            await invokeAdminAction('deleteVendorUser', { uid: vendorId })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendors-page'] })
            setDeleteConfirmOpen(false)
            setVendorToDelete(null)
        },
        onError: (error) => {
            console.error('Error deleting vendor: ', error)
            alert('Failed to delete vendor: ' + (error instanceof Error ? error.message : 'Unknown error'))
        }
    })

    const loading = isLoading

    const handleAddVendor = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!form.name || !form.email || !form.password || !form.categoryIds.length) return
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

    const exportCsv = async () => {
        setExporting(true)
        try {
            const vendors = await fetchAllVendors()
            const fields = ['id','name','status','contact','vendorType','categoryIds','mainCategory','subcategory','website','instagramUrl','address','locations','profilePicture','coverImage','galleryImages','offers'] as const
            const quote = (value: unknown) => `"${String(value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : value).replaceAll('"','""')}"`
            const csv = [fields.map(quote).join(','), ...vendors.map(v => fields.map(key => quote(v[key])).join(','))].join('\r\n')
            const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
            const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'kouponly-vendors.csv'; anchor.click(); URL.revokeObjectURL(url)
        } catch (error) { alert(`Vendor export failed: ${error instanceof Error ? error.message : 'Unknown error'}`) }
        finally { setExporting(false) }
    }

    return (
        <div className="p-4 sm:p-8 space-y-6 w-full max-w-[1600px] mx-auto">
            <div><h1 className="text-2xl font-semibold tracking-tight">Vendors & offers</h1>
                <p className="mt-1 text-sm text-muted-foreground">Manage vendor profiles, offers and branch locations shown in the app.</p></div>

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
                            aria-label="Search vendors"
                            placeholder="Search vendor, category or contact"
                            className="pl-9 bg-card h-10"
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
                    {searchQuery && <Button variant="ghost" onClick={() => { setSearchInput(''); updateFilters({ search: '' }) }}>Clear</Button>}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button type="button" variant="outline" onClick={() => void exportCsv()} disabled={exporting}>{exporting ? 'Preparing…' : 'Export CSV'}</Button>
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-brand-green hover:bg-brand-green/90 text-white gap-2 h-10">
                                <Plus className="h-4 w-4" /> Add New Vendor
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Add New Vendor</DialogTitle>
                                <DialogDescription>Create a vendor account, then add its profile, offers and branches.</DialogDescription>
                            </DialogHeader>
                            <form id="add-vendor" onSubmit={handleAddVendor} className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Vendor Name</Label>
                                    <Input
                                        id="name"
                                        required
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        placeholder="Enter vendor name"
                                        disabled={addVendorMutation.isPending}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Main categories</Label>
                                    <p className="text-xs text-muted-foreground">The first selected category is primary.</p>
                                    <div className="flex flex-wrap gap-2">
                                        {categories.map(category => {
                                            const selected = form.categoryIds.includes(category.id)
                                            return <label key={category.id} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                                                <input type="checkbox" checked={selected} disabled={addVendorMutation.isPending || (selected && form.categoryIds.length === 1)} onChange={() => setForm({ ...form, categoryIds: selected ? form.categoryIds.filter(id => id !== category.id) : [...form.categoryIds, category.id] })} />
                                                {category.nameEnglish}{form.categoryIds[0] === category.id ? ' · Primary' : ''}
                                            </label>
                                        })}
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        required
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
                                        required
                                        minLength={6}
                                        autoComplete="new-password"
                                        value={form.password}
                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        placeholder="At least 6 characters"
                                        disabled={addVendorMutation.isPending}
                                    />
                                </div>
                            </form>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    className="bg-brand-green hover:bg-brand-green/90 text-white"
                                    type="submit"
                                    form="add-vendor"
                                    disabled={addVendorMutation.isPending || !form.categoryIds.length}
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
                        <SelectTrigger aria-label="Sort vendors" className="w-[130px] h-10 bg-card">
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
            <p role="status" className="text-sm text-muted-foreground">
                {loading ? 'Loading vendors…' : `${totalVendors} vendor${totalVendors !== 1 ? 's' : ''}${searchQuery ? ` matching “${searchQuery}”` : ''}`}
            </p>
            {isError && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                <p className="flex-1">Could not load vendors: {error.message}</p><Button variant="outline" onClick={() => void refetch()}>Try again</Button>
            </div>}

            <div className="overflow-x-auto rounded-2xl border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-none">
                            <TableHead>Vendor</TableHead>
                            <TableHead>Category & subcategories</TableHead>
                            <TableHead>Mobile status</TableHead>
                            <TableHead>Offers / branches</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead className="text-right pr-8">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
                                        <p className="text-muted-foreground font-medium">Loading vendors...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : isError ? null : vendorList.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                    {searchQuery
                                        ? 'No vendors match your filters.'
                                        : 'No vendors found.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            vendorList.map((vendor: Vendor) => (
                                <TableRow key={vendor.id} className="h-16 border-b border-gray-100 hover:bg-gray-50/50">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            {vendor.profilePicture ? (
                                            <img src={vendor.profilePicture} alt={vendor.name || 'Vendor'} className="h-10 w-10 rounded-lg object-cover shrink-0" loading="lazy" />
                                            ) : (
                                                <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                                    <span className="text-gray-400 text-xs font-bold">{(vendor.name || 'V').charAt(0)}</span>
                                                </div>
                                            )}
                                            <Link to="/admin/vendors/$vendorId/settings/branding" params={{ vendorId: vendor.id }} className="font-medium text-base underline-offset-4 hover:underline">{vendor.name || 'Vendor'}</Link>
                                        </div>
                                    </TableCell>
                                    <TableCell><p>{(vendor.categoryIds?.length ? vendor.categoryIds.map(id => categories.find(category => category.id === id)?.nameEnglish || id) : [vendor.mainCategory || 'Not assigned']).join(', ')}</p><p className="text-xs text-muted-foreground">{vendor.subcategory?.join(', ') || 'No subcategories'}</p></TableCell>
                                    <TableCell>{vendor.status || 'Unknown'}</TableCell>
                                    <TableCell><div className="flex flex-col gap-1">
                                        <Link to="/admin/vendors/$vendorId/settings/offers" params={{ vendorId: vendor.id }} className="w-fit text-sm underline underline-offset-4">{vendor.offers?.length ?? 0} offers</Link>
                                        <Link to="/admin/vendors/$vendorId/settings/location" params={{ vendorId: vendor.id }} className="w-fit text-sm text-muted-foreground underline underline-offset-4">{vendor.locations?.length ?? 0} branches</Link>
                                    </div></TableCell>
                                    <TableCell className="font-medium text-gray-900">{vendor.contact}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button asChild variant="outline" size="sm" className="h-9 px-4 gap-1 text-xs font-semibold">
                                                <Link to="/admin/vendors/$vendorId/settings" params={{ vendorId: vendor.id }}>Manage <ChevronRight className="h-3 w-3" /></Link>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                                                aria-label={`Delete ${vendor.name || 'vendor'}`}
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
