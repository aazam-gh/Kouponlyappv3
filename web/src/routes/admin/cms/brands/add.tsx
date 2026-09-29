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
import type { BrandItem } from '@/types/brands'
import { getVendorList, type VendorOption } from '@/lib/vendorList'
import { uploadImage } from '@/lib/upload'

export const Route = createFileRoute('/admin/cms/brands/add')({
    component: AddBrandPage,
})

function AddBrandPage() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [vendors, setVendors] = useState<VendorOption[]>([])

    useEffect(() => {
        getVendorList().then(setVendors).catch(err => console.error('Error fetching vendor list:', err))
    }, [])

    const [brand, setBrand] = useState<BrandItem>({
        id: `brand_${Math.random().toString(36).substr(2, 9)}`,
        logoUrl: '',
        isActive: true
    })

    const fileInputRef = useRef<HTMLInputElement>(null)

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const downloadURL = await uploadImage(
                `brands/${brand.id}/${Date.now()}_${file.name}`,
                file,
                { maxWidth: 512, quality: 0.8 }
            )

            setBrand(prev => ({
                ...prev,
                logoUrl: downloadURL
            }))
            toast.success('Logo uploaded')
        } catch (error) {
            console.error('Error uploading image:', error)
            toast.error('Failed to upload image')
        } finally {
            setUploading(false)
        }
    }

    const handleSave = async () => {
        if (!brand.logoUrl) {
            toast.error('Please upload a logo')
            return
        }

        setLoading(true)
        try {
            const cmsRef = doc(db, 'cms', 'brand')
            const cmsSnap = await getDoc(cmsRef)

            let brandsList: BrandItem[] = []
            if (cmsSnap.exists()) {
                brandsList = cmsSnap.data().brands || []
            }

            brandsList.push(brand)

            await setDoc(cmsRef, {
                brands: brandsList,
                lastUpdated: new Date().toISOString()
            }, { merge: true })

            toast.success('Brand added successfully')
            navigate({ to: '/admin/cms/brands' })
        } catch (error) {
            console.error('Error saving brand:', error)
            toast.error('Failed to add brand')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-8 space-y-8 max-w-4xl mx-auto font-sans bg-white min-h-screen">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full bg-gray-100 hover:bg-gray-200"
                        onClick={() => navigate({ to: '/admin/cms/brands' })}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">✨</span>
                        <h1 className="text-3xl font-bold tracking-tight">Add New Brand</h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={() => navigate({ to: '/admin/cms/brands' })}
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
                        Save Brand
                    </Button>
                </div>
            </div>

            <div className="bg-[#F8F9F9] rounded-[2.5rem] p-10 space-y-10 border border-gray-100 shadow-sm">
                <div className="max-w-md mx-auto">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <p className="text-sm font-bold text-gray-900 uppercase tracking-wider">Brand Logo</p>
                        </div>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="relative aspect-square w-48 mx-auto rounded-[2rem] overflow-hidden bg-white border-2 border-dashed border-gray-200 cursor-pointer hover:border-purple-400 transition-all flex flex-col items-center justify-center group"
                        >
                            {brand.logoUrl ? (
                                <>
                                    <img src={brand.logoUrl} className="w-full h-full object-contain p-4" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="text-white text-xs font-bold px-4 py-2 bg-black/50 rounded-full">Change Logo</span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center gap-3 opacity-30">
                                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                        <ImageIcon className="w-6 h-6" />
                                    </div>
                                    <span className="text-xs font-bold">Select Logo</span>
                                </div>
                            )}
                            {uploading && (
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
                            onChange={onFileChange}
                        />
                    </div>
                </div>

                <div className="max-w-xl mx-auto space-y-8 pt-4">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 ml-1">Link to Vendor</label>
                        <select
                            value={brand.vendorId || ''}
                            onChange={(e) => setBrand(prev => ({ ...prev, vendorId: e.target.value }))}
                            className="w-full h-14 px-6 rounded-[1.25rem] bg-white border border-gray-100 font-bold text-gray-900 outline-none focus:border-purple-400 transition-all shadow-sm focus:ring-4 focus:ring-purple-50 appearance-none cursor-pointer"
                        >
                            <option value="">— No linked vendor —</option>
                            {vendors.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>
                        {brand.vendorId && (
                            <p className="text-xs text-purple-500 font-medium ml-1">
                                Linked: {vendors.find(v => v.id === brand.vendorId)?.name || brand.vendorId}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-4 bg-white p-6 rounded-[1.5rem] border border-gray-50 w-fit">
                        <button
                            onClick={() => setBrand(prev => ({ ...prev, isActive: !prev.isActive }))}
                            className={`w-14 h-7 rounded-full transition-colors relative shadow-inner ${brand.isActive ? "bg-purple-600" : "bg-gray-200"}`}
                        >
                            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all transform shadow-sm ${brand.isActive ? "left-8" : "left-1"}`} />
                        </button>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900 leading-none">Brand Active</span>
                            <span className="text-xs text-gray-400 mt-1 font-medium">Visible to users if enabled</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="h-20" />
        </div>
    )
}
