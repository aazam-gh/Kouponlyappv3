import { useState, useEffect, useRef } from 'react'
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router'
import {
    ArrowLeft,
    ArrowUp,
    ArrowDown,
    Image as ImageIcon,
    Plus,
    Trash2,
    Loader2
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
import type { BannerItem } from '@/types/banners'
import { getVendorList, type VendorOption } from '@/lib/vendorList'
import { uploadImage } from '@/lib/upload'

export const Route = createLazyFileRoute('/admin/cms/banners/')({
    component: BannersManagement,
})

function BannersManagement() {
    const navigate = useNavigate()
    const [banners, setBanners] = useState<BannerItem[]>([])
    const [lastUpdated, setLastUpdated] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState<string | null>(null)
    const [activeBannerId, setActiveBannerId] = useState<string | null>(null)
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
            const cmsRef = doc(db, 'cms', 'banner')
            const cmsSnap = await getDoc(cmsRef)

            if (cmsSnap.exists()) {
                const data = cmsSnap.data()
                setBanners(data.banners || [])
                setLastUpdated(data.lastUpdated || '')
            } else {
                setBanners([])
                setLastUpdated('')
            }
        } catch (error) {
            console.error('Error fetching data:', error)
            toast.error('Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    const saveBanners = async (updatedBanners: BannerItem[]) => {
        try {
            const cmsRef = doc(db, 'cms', 'banner')
            const lastUpdated = new Date().toISOString()

            await setDoc(cmsRef, {
                banners: updatedBanners,
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
            setBanners(updatedBanners)
            toast.success('Banners updated successfully')
        } catch (error) {
            console.error('Error saving banners:', error)
            toast.error('Failed to save changes')
        }
    }

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>, bannerId: string, type: 'mobile') => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(type)
        try {
            const downloadURL = await uploadImage(
                `banners/${type}/${Date.now()}_${file.name}`,
                file,
                { maxWidth: 1920, quality: 0.8 }
            )

            const updatedBanners = banners.map(b => {
                if (b.bannerId === bannerId) {
                    if (b.images[type]) {
                        setPendingDeletions(prev => [...prev, b.images[type]])
                    }
                    return {
                        ...b,
                        images: {
                            ...b.images,
                            [type]: downloadURL
                        }
                    }
                }
                return b
            })

            setBanners(updatedBanners)
            toast.success(`${type} image uploaded`)
        } catch (error) {
            console.error('Error uploading image:', error)
            toast.error('Failed to upload image')
        } finally {
            setUploading(null)
        }
    }

    const handleDeleteBanner = async (bannerId: string) => {
        if (!confirm('Are you sure you want to delete this banner?')) return
        try {
            const bannerToDelete = banners.find(b => b.bannerId === bannerId)
            const remainingBanners = banners.filter(b => b.bannerId !== bannerId)

            if (bannerToDelete) {
                const urls: string[] = []
                if (bannerToDelete.images.mobile) urls.push(bannerToDelete.images.mobile)

                const cmsRef = doc(db, 'cms', 'banner')
                await setDoc(cmsRef, {
                    banners: remainingBanners,
                    lastUpdated: new Date().toISOString()
                })

                if (urls.length > 0) {
                    await Promise.all(urls.map(async (url) => {
                        try {
                            const imageRef = ref(storage, url)
                            await deleteObject(imageRef)
                        } catch (err) {
                            console.error('Failed to delete storage object:', url, err)
                        }
                    }))
                }
            }
            setBanners(remainingBanners)
            toast.success('Banner deleted')
        } catch (error) {
            console.error('Error deleting banner:', error)
            toast.error('Failed to delete banner')
        }
    }

    const handleUpdateBanner = (bannerId: string, updates: Partial<BannerItem>) => {
        setBanners(banners.map(b => b.bannerId === bannerId ? { ...b, ...updates } : b))
    }

    const triggerUpload = (bannerId: string) => {
        setActiveBannerId(bannerId)
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
                        <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                            <ImageIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Banners</h1>
                            <p className="text-xs text-gray-500 font-medium">{banners.length} banner{banners.length !== 1 ? 's' : ''} configured</p>
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
                        onClick={() => saveBanners(banners)}
                        className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-6 h-10 font-bold shadow-md shadow-purple-200 transition-all"
                    >
                        Save All Changes
                    </Button>
                </div>
            </div>

            {/* Section Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <h2 className="text-lg font-bold text-gray-900">Configured Banners</h2>
                <Link
                    to="/admin/cms/banners/add"
                    className="inline-flex items-center justify-center bg-[#F8F9F9] hover:bg-gray-100 text-gray-900 border border-gray-100 rounded-xl px-5 h-10 gap-2 font-bold text-sm shadow-sm transition-all"
                >
                    <Plus className="w-4 h-4 text-purple-600" />
                    Add New Banner
                </Link>

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => activeBannerId && onFileChange(e, activeBannerId, 'mobile')}
                />
            </div>

            {/* Banner Cards */}
            <div className="grid grid-cols-1 gap-6">
                {banners.map((banner, index) => (
                    <div key={banner.bannerId} className="bg-[#F8F9F9] rounded-2xl p-6 space-y-5 border border-gray-100 shadow-sm relative group">
                        <div className="flex flex-col lg:flex-row gap-6">
                            {/* Image */}
                            <div className="flex-1 space-y-1.5">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Banner Image</p>
                                <div
                                    onClick={() => triggerUpload(banner.bannerId)}
                                    className="relative w-full aspect-[21/9] rounded-xl overflow-hidden bg-white border-2 border-dashed border-gray-200 cursor-pointer hover:border-purple-400 transition-all flex flex-col items-center justify-center group/img"
                                >
                                    {banner.images.mobile ? (
                                        <img src={banner.images.mobile} className="w-full h-full object-cover" loading="lazy" />
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 opacity-30">
                                            <ImageIcon className="w-8 h-8" />
                                            <span className="text-[10px] font-bold">Recommended: 1080x460</span>
                                        </div>
                                    )}
                                    {uploading === 'mobile' && activeBannerId === banner.bannerId && (
                                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="text-white text-xs font-bold px-3 py-1.5 bg-black/50 rounded-xl">Change Image</span>
                                    </div>
                                </div>
                            </div>

                            {/* Fields */}
                            <div className="flex-1 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Vendor</label>
                                        <select
                                            value={banner.vendorId}
                                            onChange={(e) => handleUpdateBanner(banner.bannerId, { vendorId: e.target.value })}
                                            className="w-full h-11 px-4 rounded-xl bg-white border border-gray-100 font-bold text-sm text-gray-900 outline-none focus:border-purple-400 transition-all shadow-sm appearance-none cursor-pointer"
                                        >
                                            <option value="">— No linked vendor —</option>
                                            {vendors.map(v => (
                                                <option key={v.id} value={v.id}>{v.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Alt Text</label>
                                        <input
                                            value={banner.altText}
                                            onChange={(e) => handleUpdateBanner(banner.bannerId, { altText: e.target.value })}
                                            placeholder="50% off Winter Gear"
                                            className="w-full h-11 px-4 rounded-xl bg-white border border-gray-100 font-medium text-sm text-gray-900 outline-none focus:border-purple-400 transition-all shadow-sm"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-gray-200/60">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleUpdateBanner(banner.bannerId, { isActive: !banner.isActive })}
                                            className={cn(
                                                "w-11 h-6 rounded-full transition-colors relative shadow-inner",
                                                banner.isActive ? "bg-purple-600" : "bg-gray-200"
                                            )}
                                        >
                                            <div className={cn(
                                                "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all transform shadow-sm",
                                                banner.isActive ? "left-5.5" : "left-0.5"
                                            )} />
                                        </button>
                                        <span className="text-xs font-bold text-gray-500">
                                            {banner.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>

                                    <div className="flex gap-1.5">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => {
                                                const updated = [...banners]
                                                if (index > 0) {
                                                    const temp = updated[index]
                                                    updated[index] = updated[index - 1]
                                                    updated[index - 1] = temp
                                                    setBanners(updated)
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
                                                const updated = [...banners]
                                                if (index < banners.length - 1) {
                                                    const temp = updated[index]
                                                    updated[index] = updated[index + 1]
                                                    updated[index + 1] = temp
                                                    setBanners(updated)
                                                }
                                            }}
                                            disabled={index === banners.length - 1}
                                            className="rounded-xl h-9 w-9 border-gray-100 bg-white text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                                        >
                                            <ArrowDown className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => handleDeleteBanner(banner.bannerId)}
                                            className="rounded-xl h-9 w-9 border-gray-100 text-red-400 hover:text-red-600 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {banners.length === 0 && (
                    <div className="py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-3">
                        <div className="bg-white p-4 rounded-xl shadow-sm">
                            <ImageIcon className="w-10 h-10 opacity-30 text-purple-600" />
                        </div>
                        <p className="font-bold text-lg text-gray-500">No banners yet</p>
                        <p className="text-sm">Click 'Add New Banner' to create your first one.</p>
                    </div>
                )}
            </div>

            <div className="h-20" />
        </div>
    )
}
