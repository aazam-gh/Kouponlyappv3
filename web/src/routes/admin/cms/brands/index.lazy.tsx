import { useState, useEffect, useRef } from 'react'
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router'
import {
    ArrowLeft,
    ArrowUp,
    ArrowDown,
    Image as ImageIcon,
    Plus,
    Trash2,
    Loader2,
    Type
} from 'lucide-react'
import { db, storage } from '@/firebase/config'
import {
    getDoc,
    doc,
    setDoc
} from 'firebase/firestore'
import { ref, deleteObject } from 'firebase/storage'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Link } from '@tanstack/react-router'
import type { BrandItem } from '@/types/brands'
import { getVendorList, type VendorOption } from '@/lib/vendorList'
import { uploadImage } from '@/lib/upload'

export const Route = createLazyFileRoute('/admin/cms/brands/')({
    component: BrandsManagement,
})

function BrandsManagement() {
    const navigate = useNavigate()
    const [brands, setBrands] = useState<BrandItem[]>([])
    const [lastUpdated, setLastUpdated] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState<string | null>(null)
    const [activeBrandId, setActiveBrandId] = useState<string | null>(null)
    const [pendingDeletions, setPendingDeletions] = useState<string[]>([])
    const [vendors, setVendors] = useState<VendorOption[]>([])

    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        fetchData()
        getVendorList().then(setVendors).catch(err => console.error('Error fetching vendor list:', err))
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const cmsRef = doc(db, 'cms', 'brand')
            const cmsSnap = await getDoc(cmsRef)

            if (cmsSnap.exists()) {
                const data = cmsSnap.data()
                setBrands(data.brands || [])
                setLastUpdated(data.lastUpdated || '')
            } else {
                setBrands([])
                setLastUpdated('')
            }
        } catch (error) {
            console.error('Error fetching data:', error)
            toast.error('Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    const saveBrands = async (updatedBrands: BrandItem[]) => {
        try {
            const cmsRef = doc(db, 'cms', 'brand')
            const lastUpdated = new Date().toISOString()

            await setDoc(cmsRef, {
                brands: updatedBrands,
                lastUpdated: lastUpdated
            })

            if (pendingDeletions.length > 0) {
                await Promise.all(pendingDeletions.map(async (url) => {
                    try {
                        const imageRef = ref(storage, url)
                        await deleteObject(imageRef)
                    } catch (err) {
                        console.error('Failed to delete storage object:', url, err)
                    }
                }))
                setPendingDeletions([])
            }

            setLastUpdated(lastUpdated)
            setBrands(updatedBrands)
            toast.success('Brands updated successfully')
        } catch (error) {
            console.error('Error saving brands:', error)
            toast.error('Failed to save changes')
        }
    }

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>, brandId: string) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(brandId)
        try {
            const downloadURL = await uploadImage(
                `brands/${brandId}/${Date.now()}_${file.name}`,
                file,
                { maxWidth: 512, quality: 0.8 }
            )

            const updatedBrands = brands.map(b => {
                if (b.id === brandId) {
                    if (b.logoUrl) {
                        setPendingDeletions(prev => [...prev, b.logoUrl])
                    }
                    return {
                        ...b,
                        logoUrl: downloadURL
                    }
                }
                return b
            })

            setBrands(updatedBrands)
            toast.success('Logo uploaded')
        } catch (error) {
            console.error('Error uploading image:', error)
            toast.error('Failed to upload image')
        } finally {
            setUploading(null)
        }
    }

    const handleDeleteBrand = async (brandId: string) => {
        if (!confirm('Are you sure you want to delete this brand?')) return
        try {
            const brandToDelete = brands.find(b => b.id === brandId)
            const remainingBrands = brands.filter(b => b.id !== brandId)

            if (brandToDelete) {
                const cmsRef = doc(db, 'cms', 'brand')
                await setDoc(cmsRef, {
                    brands: remainingBrands,
                    lastUpdated: new Date().toISOString()
                })

                if (brandToDelete.logoUrl) {
                    try {
                        const imageRef = ref(storage, brandToDelete.logoUrl)
                        await deleteObject(imageRef)
                    } catch (err) {
                        console.error('Failed to delete storage object:', brandToDelete.logoUrl, err)
                    }
                }
            }
            setBrands(remainingBrands)
            toast.success('Brand deleted')
        } catch (error) {
            console.error('Error deleting brand:', error)
            toast.error('Failed to delete brand')
        }
    }

    const handleUpdateBrand = (brandId: string, updates: Partial<BrandItem>) => {
        setBrands(brands.map(b => b.id === brandId ? { ...b, ...updates } : b))
    }

    const triggerUpload = (brandId: string) => {
        setActiveBrandId(brandId)
        fileInputRef.current?.click()
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        )
    }

    return (
        <div className="p-8 space-y-8 max-w-6xl mx-auto font-sans bg-white min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-xl bg-gray-100 hover:bg-gray-200"
                        onClick={() => navigate({ to: '/admin/cms' })}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <Type className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Top Brands</h1>
                            <p className="text-xs text-gray-500 font-medium">{brands.length} brand{brands.length !== 1 ? 's' : ''} configured</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <p className="text-xs text-gray-400 font-medium">Last Updated</p>
                        <p className="text-sm font-bold text-gray-900">
                            {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Never'}
                        </p>
                    </div>
                    <Button
                        onClick={() => saveBrands(brands)}
                        className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-6 h-10 font-bold shadow-lg shadow-purple-200 transition-all"
                    >
                        Save All Changes
                    </Button>
                </div>
            </div>

            {/* Section Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <h2 className="text-lg font-bold text-gray-900">Configure Brands</h2>
                <Link
                    to="/admin/cms/brands/add"
                    className="inline-flex items-center justify-center bg-[#F8F9F9] hover:bg-gray-100 text-gray-900 border border-gray-100 rounded-xl px-5 h-10 gap-2 font-bold text-sm shadow-sm transition-all"
                >
                    <Plus className="w-4 h-4 text-purple-600" />
                    Add New Brand
                </Link>

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => activeBrandId && onFileChange(e, activeBrandId)}
                />
            </div>

            {/* Brand Cards */}
            <div className="grid grid-cols-1 gap-4">
                {brands.map((brand, index) => (
                    <div key={brand.id} className="bg-[#F8F9F9] rounded-2xl p-6 border border-gray-100 shadow-sm relative group">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            {/* Logo */}
                            <div className="w-24 h-24 flex-shrink-0">
                                <div
                                    onClick={() => triggerUpload(brand.id)}
                                    className="relative w-full h-full rounded-xl overflow-hidden bg-white border-2 border-dashed border-gray-200 cursor-pointer hover:border-purple-400 transition-all flex items-center justify-center group/img"
                                >
                                    {brand.logoUrl ? (
                                        <img src={brand.logoUrl} className="w-full h-full object-contain p-2" loading="lazy" />
                                    ) : (
                                        <div className="flex flex-col items-center gap-1 opacity-30">
                                            <ImageIcon className="w-6 h-6" />
                                            <span className="text-[10px] font-bold text-center">Logo</span>
                                        </div>
                                    )}
                                    {uploading === brand.id && (
                                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                            <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="text-white text-[10px] font-bold px-2 py-1 bg-black/50 rounded-xl">Change</span>
                                    </div>
                                </div>
                            </div>

                            {/* Fields */}
                            <div className="flex-1 w-full space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Vendor</label>
                                    <select
                                        value={brand.vendorId || ''}
                                        onChange={(e) => handleUpdateBrand(brand.id, { vendorId: e.target.value })}
                                        className="w-full h-11 px-4 rounded-xl bg-white border border-gray-100 font-bold text-sm text-gray-900 outline-none focus:border-purple-400 transition-all shadow-sm appearance-none cursor-pointer"
                                    >
                                        <option value="">— No linked vendor —</option>
                                        {vendors.map(v => (
                                            <option key={v.id} value={v.id}>{v.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center gap-3 pt-1">
                                    <button
                                        onClick={() => handleUpdateBrand(brand.id, { isActive: !brand.isActive })}
                                        className={cn(
                                            "w-11 h-6 rounded-full transition-colors relative shadow-inner",
                                            brand.isActive ? "bg-purple-600" : "bg-gray-200"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all transform shadow-sm",
                                            brand.isActive ? "left-5.5" : "left-0.5"
                                        )} />
                                    </button>
                                    <span className="text-xs font-bold text-gray-600">
                                        {brand.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>

                                <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-gray-200/60">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => {
                                            const updated = [...brands]
                                            if (index > 0) {
                                                const temp = updated[index]
                                                updated[index] = updated[index - 1]
                                                updated[index - 1] = temp
                                                setBrands(updated)
                                            }
                                        }}
                                        disabled={index === 0}
                                        className="rounded-xl h-9 w-9 border-gray-100 bg-white text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                                    >
                                        <ArrowUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => {
                                            const updated = [...brands]
                                            if (index < brands.length - 1) {
                                                const temp = updated[index]
                                                updated[index] = updated[index + 1]
                                                updated[index + 1] = temp
                                                setBrands(updated)
                                            }
                                        }}
                                        disabled={index === brands.length - 1}
                                        className="rounded-xl h-9 w-9 border-gray-100 bg-white text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                                    >
                                        <ArrowDown className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleDeleteBrand(brand.id)}
                                        className="rounded-xl h-9 w-9 border-gray-100 text-red-400 hover:text-red-600 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {brands.length === 0 && (
                    <div className="py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-3">
                        <div className="bg-white p-4 rounded-xl shadow-sm">
                            <ImageIcon className="w-8 h-8 opacity-30 text-purple-600" />
                        </div>
                        <p className="font-bold text-lg text-gray-500">No brands configured</p>
                        <p className="text-sm">Click 'Add New Brand' to start the list.</p>
                    </div>
                )}
            </div>

            <div className="h-20" />
        </div>
    )
}
