import { useState, useRef, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
    ArrowLeft,
    Image as ImageIcon,
    Loader2,
    Save
} from 'lucide-react'
import { db } from '@/firebase/config'
import {
    doc,
    getDoc,
    setDoc
} from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { BannerItem } from '@/types/banners'
import { getVendorList, type VendorOption } from '@/lib/vendorList'
import { uploadImage } from '@/lib/upload'

export const Route = createFileRoute('/admin/cms/banners/add')({
    component: AddBannerPage,
})

function AddBannerPage() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState<'mobile' | null>(null)
    const [vendors, setVendors] = useState<VendorOption[]>([])

    useEffect(() => {
        getVendorList().then(setVendors).catch(err => console.error('Error fetching vendor list:', err))
    }, [])

    const [banner, setBanner] = useState<BannerItem>({
        bannerId: `promo_${Math.random().toString(36).substr(2, 9)}`,
        vendorId: '',
        images: {
            mobile: ''
        },
        altText: '',
        isActive: true
    })

    const fileInputRef = useRef<HTMLInputElement>(null)
    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'mobile') => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(type)
        try {
            const downloadURL = await uploadImage(
                `banners/${type}/${Date.now()}_${file.name}`,
                file,
                { maxWidth: 1920, quality: 0.8 }
            )

            setBanner(prev => ({
                ...prev,
                images: {
                    ...prev.images,
                    [type]: downloadURL
                }
            }))
            toast.success(`${type} image uploaded`)
        } catch (error) {
            console.error('Error uploading image:', error)
            toast.error('Failed to upload image')
        } finally {
            setUploading(null)
        }
    }

    const handleSave = async () => {
        if (!banner.images.mobile) {
            toast.error('Please upload an image')
            return
        }

        setLoading(true)
        try {
            const cmsRef = doc(db, 'cms', 'banner')
            const cmsSnap = await getDoc(cmsRef)

            let bannersList: BannerItem[] = []
            if (cmsSnap.exists()) {
                bannersList = cmsSnap.data().banners || []
            }

            bannersList.push(banner)

            await setDoc(cmsRef, {
                banners: bannersList,
                lastUpdated: new Date().toISOString()
            }, { merge: true })

            toast.success('Banner added successfully')
            navigate({ to: '/admin/cms/banners' })
        } catch (error) {
            console.error('Error saving banner:', error)
            toast.error('Failed to add banner')
        } finally {
            setLoading(false)
        }
    }


    return (
        <div className="p-8 space-y-8 max-w-4xl mx-auto font-sans bg-white min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full bg-gray-100 hover:bg-gray-200"
                        onClick={() => navigate({ to: '/admin/cms/banners' })}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">✨</span>
                        <h1 className="text-3xl font-bold tracking-tight">Add New Banner</h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={() => navigate({ to: '/admin/cms/banners' })}
                        className="rounded-xl px-6 h-11 font-bold border-gray-200 hover:bg-gray-50"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-8 h-11 font-bold shadow-lg shadow-purple-200 transition-all flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Banner
                    </Button>
                </div>
            </div>

            <div className="bg-[#F8F9F9] rounded-[2.5rem] p-10 space-y-10 border border-gray-100 shadow-sm">
                <div className="max-w-xl mx-auto">
                    {/* Banner Upload */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <p className="text-sm font-bold text-gray-900 uppercase tracking-wider">Banner Image</p>
                            <span className="text-[10px] text-gray-400 font-bold">Recommended: 1080x460</span>
                        </div>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="relative aspect-[21/9] rounded-[2rem] overflow-hidden bg-white border-2 border-dashed border-gray-200 cursor-pointer hover:border-purple-400 transition-all flex flex-col items-center justify-center group"
                        >
                            {banner.images.mobile ? (
                                <>
                                    <img src={banner.images.mobile} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="text-white text-xs font-bold px-4 py-2 bg-black/50 rounded-full">Change Image</span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center gap-3 opacity-30">
                                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                        <ImageIcon className="w-6 h-6" />
                                    </div>
                                    <span className="text-xs font-bold">Select Banner Image</span>
                                </div>
                            )}
                            {uploading === 'mobile' && (
                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                                </div>
                            )}
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => onFileChange(e, 'mobile')}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 ml-1">Link to Vendor</label>
                        <select
                            value={banner.vendorId}
                            onChange={(e) => setBanner(prev => ({ ...prev, vendorId: e.target.value }))}
                            className="w-full h-14 px-6 rounded-[1.25rem] bg-white border border-gray-100 font-bold text-gray-900 outline-none focus:border-purple-400 transition-all shadow-sm focus:ring-4 focus:ring-purple-50 appearance-none cursor-pointer"
                        >
                            <option value="">— No linked vendor —</option>
                            {vendors.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>
                        {banner.vendorId && (
                            <p className="text-xs text-purple-500 font-medium ml-1">
                                Linked: {vendors.find(v => v.id === banner.vendorId)?.name || banner.vendorId}
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 ml-1">Alt Text (Accessibility)</label>
                        <input
                            value={banner.altText}
                            onChange={(e) => setBanner(prev => ({ ...prev, altText: e.target.value }))}
                            placeholder="e.g. 50% off Winter Gear"
                            className="w-full h-14 px-6 rounded-[1.25rem] bg-white border border-gray-100 font-medium text-gray-900 outline-none focus:border-purple-400 transition-all shadow-sm focus:ring-4 focus:ring-purple-50"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-white p-6 rounded-[1.5rem] border border-gray-50 w-fit">
                    <button
                        onClick={() => setBanner(prev => ({ ...prev, isActive: !prev.isActive }))}
                        className={`w-14 h-7 rounded-full transition-colors relative shadow-inner ${banner.isActive ? "bg-purple-600" : "bg-gray-200"}`}
                    >
                        <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all transform shadow-sm ${banner.isActive ? "left-8" : "left-1"}`} />
                    </button>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900 leading-none">Banner Active</span>
                        <span className="text-xs text-gray-400 mt-1 font-medium">Visible to users if enabled</span>
                    </div>
                </div>
            </div>

            <div className="h-20" />
        </div>
    )
}
