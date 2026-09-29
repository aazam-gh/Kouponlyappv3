import { useEffect, useState } from 'react'
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router'
import {
    ArrowLeft,
    Image as ImageIcon,
    Loader2,
    Save,
    Sparkles,
    Upload
} from 'lucide-react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { uploadImage } from '@/lib/upload'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type {
    FeaturedBrandShowcaseConfig,
    FeaturedBrandShowcaseItem
} from '@/types/featured-brand-showcase'

const TILE_COUNT = 3
const CMS_DOC_ID = 'featuredBrandShowcase'

type UploadSlot = 'hero' | `tile-${number}`

export const Route = createLazyFileRoute('/admin/cms/featured-brand-showcase/')({
    component: FeaturedBrandShowcaseManagement,
})

function createEmptyItem(): FeaturedBrandShowcaseItem {
    return {
        id: `showcase_${Math.random().toString(36).slice(2, 11)}`,
        title: '',
        titleAr: '',
        orderUrl: '',
        isActive: false,
        heroImageUrl: '',
        tileImageUrls: Array(TILE_COUNT).fill(''),
        altText: '',
        order: 0,
    }
}

function normalizeItem(item: FeaturedBrandShowcaseItem): FeaturedBrandShowcaseItem {
    const tileImageUrls = [...(item.tileImageUrls || [])]
    while (tileImageUrls.length < TILE_COUNT) tileImageUrls.push('')

    return {
        ...createEmptyItem(),
        ...item,
        tileImageUrls: tileImageUrls.slice(0, TILE_COUNT),
    }
}

function getEditableItem(items: FeaturedBrandShowcaseItem[]) {
    if (!items.length) return createEmptyItem()

    const sortedItems = items
        .map(normalizeItem)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    return sortedItems.find(isRenderableItem) || sortedItems[0]
}

function isValidUrl(value: string) {
    try {
        new URL(value)
        return true
    } catch {
        return false
    }
}

function isRenderableItem(item: FeaturedBrandShowcaseItem) {
    return (
        item.isActive &&
        item.title.trim() &&
        isValidUrl(item.orderUrl.trim()) &&
        item.heroImageUrl &&
        item.tileImageUrls.filter(Boolean).length >= TILE_COUNT
    )
}

function FeaturedBrandShowcaseManagement() {
    const navigate = useNavigate()
    const [item, setItem] = useState<FeaturedBrandShowcaseItem>(() => createEmptyItem())
    const [lastUpdated, setLastUpdated] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploadingSlot, setUploadingSlot] = useState<UploadSlot | null>(null)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const cmsRef = doc(db, 'cms', CMS_DOC_ID)
            const cmsSnap = await getDoc(cmsRef)

            if (cmsSnap.exists()) {
                const data = cmsSnap.data() as FeaturedBrandShowcaseConfig
                setItem(getEditableItem(data.items || []))
                setLastUpdated(data.lastUpdated || '')
            } else {
                setItem(createEmptyItem())
                setLastUpdated('')
            }
        } catch (error) {
            console.error('Error fetching featured brand showcase:', error)
            toast.error('Failed to load showcase')
        } finally {
            setLoading(false)
        }
    }

    const updateItem = (updates: Partial<FeaturedBrandShowcaseItem>) => {
        setItem(prev => ({ ...prev, ...updates }))
    }

    const updateTileImage = (index: number, imageUrl: string) => {
        setItem(prev => {
            const tileImageUrls = [...prev.tileImageUrls]
            tileImageUrls[index] = imageUrl
            return { ...prev, tileImageUrls }
        })
    }

    const handleUpload = async (
        event: React.ChangeEvent<HTMLInputElement>,
        slot: UploadSlot,
        tileIndex?: number
    ) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return

        setUploadingSlot(slot)
        try {
            const timestamp = Date.now()
            const downloadURL = await uploadImage(
                slot === 'hero'
                    ? `featured-brand-showcase/${item.id}/hero/${timestamp}_${file.name}`
                    : `featured-brand-showcase/${item.id}/tiles/${tileIndex}_${timestamp}_${file.name}`,
                file,
                { maxWidth: slot === 'hero' ? 1920 : 900, quality: 0.8 }
            )

            if (slot === 'hero') {
                updateItem({ heroImageUrl: downloadURL })
            } else if (typeof tileIndex === 'number') {
                updateTileImage(tileIndex, downloadURL)
            }

            toast.success('Image uploaded')
        } catch (error) {
            console.error('Error uploading showcase image:', error)
            toast.error('Failed to upload image')
        } finally {
            setUploadingSlot(null)
        }
    }

    const validateItem = (draft: FeaturedBrandShowcaseItem) => {
        const trimmedTitle = draft.title.trim()
        const trimmedOrderUrl = draft.orderUrl.trim()
        const tileImages = draft.tileImageUrls.filter(Boolean)

        if (!trimmedTitle) return 'Title is required'
        if (!trimmedOrderUrl) return 'Order URL is required'
        if (!isValidUrl(trimmedOrderUrl)) return 'Order URL must be a valid URL'
        if (!draft.heroImageUrl) return 'Hero image is required'
        if (tileImages.length < TILE_COUNT) return 'Upload all 3 tile images before saving'

        return null
    }

    const saveShowcase = async () => {
        const validationError = validateItem(item)
        if (validationError) {
            toast.error(validationError)
            return
        }

        setSaving(true)
        try {
            const now = new Date().toISOString()
            const cleanedItem: FeaturedBrandShowcaseItem = {
                ...item,
                title: item.title.trim(),
                titleAr: item.titleAr?.trim() || '',
                orderUrl: item.orderUrl.trim(),
                altText: item.altText?.trim() || '',
                order: Number.isFinite(Number(item.order)) ? Number(item.order) : 0,
                tileImageUrls: item.tileImageUrls.slice(0, TILE_COUNT),
            }

            await setDoc(doc(db, 'cms', CMS_DOC_ID), {
                items: [cleanedItem],
                lastUpdated: now,
            } satisfies FeaturedBrandShowcaseConfig)

            setItem(cleanedItem)
            setLastUpdated(now)
            toast.success('Featured brand showcase saved')
        } catch (error) {
            console.error('Error saving featured brand showcase:', error)
            toast.error('Failed to save showcase')
        } finally {
            setSaving(false)
        }
    }

    const uploadInProgress = uploadingSlot !== null

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        )
    }

    return (
        <div className="p-8 space-y-8 max-w-6xl mx-auto font-sans bg-white min-h-screen">
            <div className="flex items-center justify-between gap-4">
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
                        <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Featured Brand Showcase</h1>
                            <p className="text-xs text-gray-500 font-medium">
                                Mobile hero campaign content
                            </p>
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
                        onClick={saveShowcase}
                        disabled={saving || uploadInProgress}
                        className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-6 h-10 font-bold shadow-md shadow-purple-200 transition-all"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        Save Changes
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] gap-6">
                <section className="bg-[#F8F9F9] rounded-2xl p-6 border border-gray-100 shadow-sm space-y-5">
                    <div className="flex items-center justify-between border-b border-gray-200/70 pb-4">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Showcase Images</h2>
                            <p className="text-sm text-gray-500">Upload one hero image and three supporting tiles.</p>
                        </div>
                        <span className={cn(
                            'text-xs font-bold px-3 py-1 rounded-full',
                            item.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
                        )}>
                            {item.isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>

                    <ImageUploadSlot
                        label="Hero Image"
                        imageUrl={item.heroImageUrl}
                        aspectClass="aspect-[16/10]"
                        uploading={uploadingSlot === 'hero'}
                        disabled={uploadInProgress}
                        onChange={(event) => handleUpload(event, 'hero')}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Array.from({ length: TILE_COUNT }).map((_, index) => {
                            const slot = `tile-${index}` as UploadSlot
                            return (
                                <ImageUploadSlot
                                    key={slot}
                                    label={`Tile ${index + 1}`}
                                    imageUrl={item.tileImageUrls[index]}
                                    aspectClass="aspect-square"
                                    uploading={uploadingSlot === slot}
                                    disabled={uploadInProgress}
                                    onChange={(event) => handleUpload(event, slot, index)}
                                />
                            )
                        })}
                    </div>
                </section>

                <section className="bg-[#F8F9F9] rounded-2xl p-6 border border-gray-100 shadow-sm space-y-5">
                    <div className="border-b border-gray-200/70 pb-4">
                        <h2 className="text-lg font-bold text-gray-900">Campaign Details</h2>
                        <p className="text-sm text-gray-500">These fields are read directly by the mobile component.</p>
                    </div>

                    <Field label="Title">
                        <input
                            value={item.title}
                            onChange={(event) => updateItem({ title: event.target.value })}
                            placeholder="OMARA APPAREL"
                            className="w-full h-11 px-4 rounded-xl bg-white border border-gray-100 font-bold text-sm text-gray-900 outline-none focus:border-purple-400 transition-all shadow-sm"
                        />
                    </Field>

                    <Field label="Title (Arabic)">
                        <input
                            dir="rtl"
                            value={item.titleAr || ''}
                            onChange={(event) => updateItem({ titleAr: event.target.value })}
                            placeholder="اومارا للملابس"
                            className="w-full h-11 px-4 rounded-xl bg-white border border-gray-100 font-bold text-sm text-gray-900 outline-none focus:border-purple-400 transition-all shadow-sm text-right"
                        />
                    </Field>

                    <Field label="Order URL">
                        <input
                            type="url"
                            value={item.orderUrl}
                            onChange={(event) => updateItem({ orderUrl: event.target.value })}
                            placeholder="https://example.com/shop"
                            className="w-full h-11 px-4 rounded-xl bg-white border border-gray-100 font-medium text-sm text-gray-900 outline-none focus:border-purple-400 transition-all shadow-sm"
                        />
                    </Field>

                    <Field label="Alt Text">
                        <input
                            value={item.altText || ''}
                            onChange={(event) => updateItem({ altText: event.target.value })}
                            placeholder="Featured apparel campaign"
                            className="w-full h-11 px-4 rounded-xl bg-white border border-gray-100 font-medium text-sm text-gray-900 outline-none focus:border-purple-400 transition-all shadow-sm"
                        />
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Order">
                            <input
                                type="number"
                                value={item.order ?? 0}
                                onChange={(event) => updateItem({ order: Number(event.target.value) })}
                                className="w-full h-11 px-4 rounded-xl bg-white border border-gray-100 font-bold text-sm text-gray-900 outline-none focus:border-purple-400 transition-all shadow-sm"
                            />
                        </Field>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Status</label>
                            <button
                                type="button"
                                onClick={() => updateItem({ isActive: !item.isActive })}
                                className="w-full h-11 px-4 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-between"
                            >
                                <span className="text-sm font-bold text-gray-700">
                                    {item.isActive ? 'Active' : 'Inactive'}
                                </span>
                                <span className={cn(
                                    'w-11 h-6 rounded-full transition-colors relative shadow-inner',
                                    item.isActive ? 'bg-purple-600' : 'bg-gray-200'
                                )}>
                                    <span className={cn(
                                        'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all transform shadow-sm',
                                        item.isActive ? 'left-5.5' : 'left-0.5'
                                    )} />
                                </span>
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            <div className="h-20" />
        </div>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">{label}</label>
            {children}
        </div>
    )
}

function ImageUploadSlot({
    label,
    imageUrl,
    aspectClass,
    uploading,
    disabled,
    onChange,
}: {
    label: string
    imageUrl: string
    aspectClass: string
    uploading: boolean
    disabled: boolean
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}) {
    return (
        <label className="block space-y-1.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">{label}</span>
            <span className={cn(
                'relative flex w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-white transition-all hover:border-purple-400',
                aspectClass
            )}>
                <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onChange}
                    disabled={disabled}
                />
                {imageUrl ? (
                    <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                    <span className="flex flex-col items-center gap-2 text-gray-400">
                        <ImageIcon className="h-8 w-8 opacity-40" />
                        <span className="text-xs font-bold">Upload image</span>
                    </span>
                )}
                {uploading && (
                    <span className="absolute inset-0 bg-white/80 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                    </span>
                )}
                <span className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="inline-flex items-center gap-2 text-white text-xs font-bold px-3 py-1.5 bg-black/50 rounded-xl">
                        <Upload className="w-3.5 h-3.5" />
                        Change Image
                    </span>
                </span>
            </span>
        </label>
    )
}
