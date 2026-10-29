import { createLazyFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowUp, ArrowDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getCmsDocument, saveCmsDocument } from '@/lib/admin-cms'
import { uploadImage } from '@/lib/upload'
import { getVendorList } from '@/lib/vendorList'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { BrandItem } from '@/types/brands'

export const Route = createLazyFileRoute('/admin/cms/brands/')({ component: TopBrands })

function TopBrands() {
    const queryClient = useQueryClient()
    const [draft, setDraft] = useState<BrandItem[]>()
    const [search, setSearch] = useState('')
    const [uploading, setUploading] = useState(false)
    const { data, isPending, error } = useQuery({
        queryKey: ['admin-top-brands'],
        queryFn: async () => {
            const [document, vendors] = await Promise.all([getCmsDocument('brand'), getVendorList()])
            return { brands: (document?.brands || []) as BrandItem[], vendors }
        },
    })
    const brands = draft ?? data?.brands ?? []
    const selected = brands.filter(brand => brand.isActive && brand.vendorId)
    const save = useMutation({
        mutationFn: () => saveCmsDocument('brand', { brands, lastUpdated: new Date().toISOString() }, { merge: true }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['admin-top-brands'] })
            setDraft(undefined)
            toast.success('Top Brands saved')
        },
        onError: error => toast.error(error instanceof Error ? error.message : 'Could not save Top Brands'),
    })
    const changeLogo = async (brandId: string, file: File) => {
        setUploading(true)
        try {
            const logoUrl = await uploadImage(`brands/${brandId}/${Date.now()}_${file.name}`, file, { maxWidth: 512, quality: 0.8 })
            setDraft(current => (current ?? brands).map(brand => brand.id === brandId ? { ...brand, logoUrl } : brand))
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not upload logo')
        } finally { setUploading(false) }
    }
    const move = (brandId: string, offset: number) => {
        const next = [...brands]
        const from = next.findIndex(brand => brand.id === brandId)
        const target = selected[selected.findIndex(brand => brand.id === brandId) + offset]
        const to = next.findIndex(brand => brand.id === target?.id)
        if (from < 0 || to < 0) return
        ;[next[from], next[to]] = [next[to], next[from]]
        setDraft(next)
    }
    return <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
        <div><h1 className="text-2xl font-semibold">Top Brands</h1><p className="mt-1 text-sm text-muted-foreground">Select vendors for Top Brands on Home. Each logo opens its vendor page. Vendors need an active offer to appear in the app.</p></div>
        {isPending ? <p>Loading vendors…</p> : error ? <p role="alert">Could not load Top Brands: {error.message}</p> : <>
            <div className="flex flex-wrap gap-3"><Input className="max-w-md" aria-label="Search Top Brands vendors" placeholder="Search vendors…" value={search} onChange={event => setSearch(event.target.value)} /><Button disabled={!draft || save.isPending || uploading} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="animate-spin" />}Save Top Brands</Button></div>
            {selected.length > 0 && <section className="space-y-2"><h2 className="font-semibold">Display order</h2>{selected.map((brand, index) => <div key={brand.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                {brand.logoUrl && <img src={brand.logoUrl} alt="" className="size-12 rounded-lg object-contain" />}
                <span className="flex-1">{index + 1}. {data?.vendors.find(vendor => vendor.id === brand.vendorId)?.name || brand.vendorId}</span>
                <Label className="relative min-h-11 cursor-pointer rounded-md border px-3 py-2">Change logo<input type="file" accept="image/*" aria-label={`Change logo for ${data?.vendors.find(vendor => vendor.id === brand.vendorId)?.name || brand.vendorId}`} className="absolute inset-0 cursor-pointer opacity-0" disabled={save.isPending || uploading} onChange={event => { const file = event.target.files?.[0]; if (file) void changeLogo(brand.id, file) }} /></Label>
                <Button variant="outline" size="icon" aria-label={`Move brand ${index + 1} up`} disabled={save.isPending || uploading || index === 0} onClick={() => move(brand.id, -1)}><ArrowUp /></Button>
                <Button variant="outline" size="icon" aria-label={`Move brand ${index + 1} down`} disabled={save.isPending || uploading || index === selected.length - 1} onClick={() => move(brand.id, 1)}><ArrowDown /></Button>
            </div>)}</section>}
            <div className="divide-y rounded-xl border">{data?.vendors.filter(vendor => vendor.name.toLowerCase().includes(search.toLowerCase())).map(vendor => {
                const included = brands.some(brand => brand.vendorId === vendor.id && brand.isActive)
                return <Label key={vendor.id} className="flex min-h-16 cursor-pointer items-center gap-4 p-4 hover:bg-muted/50">
                    <Checkbox className="size-6" checked={included} disabled={save.isPending || uploading} onCheckedChange={checked => {
                        const existing = brands.find(brand => brand.vendorId === vendor.id)
                        setDraft(existing ? brands.map(brand => brand.vendorId === vendor.id ? { ...brand, isActive: checked === true } : brand) : [...brands, { id: `vendor-${vendor.id}`, vendorId: vendor.id, logoUrl: vendor.logoUrl || '', isActive: true }])
                    }} />
                    {vendor.logoUrl && <img src={vendor.logoUrl} alt="" className="size-12 rounded-lg object-contain" />}<span>{vendor.name}</span>
                </Label>
            })}</div>
        </>}
    </div>
}
