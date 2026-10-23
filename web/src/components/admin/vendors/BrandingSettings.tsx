import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, Loader2, X, Tag, Plus, ArrowLeft, ArrowRight, Trash2 } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { categoriesQueryOptions, type Vendor } from "@/queries"
import { uploadImage } from "@/lib/upload"
import { deleteGalleryImages, VENDOR_GALLERY_LIMIT } from "@/lib/vendor-gallery"

export type VendorBrandingForm = Vendor

interface BrandingSettingsProps {
    formData: VendorBrandingForm
    setFormData: (val: VendorBrandingForm) => void
    vendorId: string
    savedGalleryImages?: string[]
    onUploadingChange?: (uploading: boolean) => void
}

export function BrandingSettings({
    formData,
    setFormData,
    vendorId,
    savedGalleryImages = [],
    onUploadingChange,
}: BrandingSettingsProps) {
    const [uploadingProfile, setUploadingProfile] = useState(false)
    const [uploadingCover, setUploadingCover] = useState(false)
    const [uploadingGallery, setUploadingGallery] = useState(false)
    const [galleryUploadProgress, setGalleryUploadProgress] = useState({ completed: 0, total: 0 })
    const profileInputRef = useRef<HTMLInputElement>(null)
    const coverInputRef = useRef<HTMLInputElement>(null)
    const galleryInputRef = useRef<HTMLInputElement>(null)
    const [tokenInput, setTokenInput] = useState("")

    const { data: categories = [] } = useQuery(categoriesQueryOptions())

    useEffect(() => {
        onUploadingChange?.(uploadingProfile || uploadingCover || uploadingGallery)
    }, [onUploadingChange, uploadingCover, uploadingGallery, uploadingProfile])

    const categoryIds = formData.categoryIds?.length ? formData.categoryIds : [formData.categoryId].filter(Boolean) as string[]
    const selectedCategory = categories.find(c => c.id === (formData.categoryId || categoryIds[0]))
    const availableSubcategories = selectedCategory?.subcategories || []

    const setCategories = (ids: string[]) => {
        if (!ids.length) return
        const primary = categories.find(category => category.id === ids[0])
        setFormData({ ...formData, categoryIds: ids, categoryId: primary?.id, mainCategory: primary?.nameEnglish, subcategory: primary?.id === selectedCategory?.id ? formData.subcategory : [] })
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'profilePicture' | 'coverImage') => {
        const file = e.target.files?.[0]
        if (!file) return

        const isProfile = type === 'profilePicture'
        if (isProfile) setUploadingProfile(true)
        else setUploadingCover(true)

        try {
            const fileName = isProfile ? 'logo' : 'banner'
            const downloadURL = await uploadImage(
                `vendors/${vendorId}/branding/${fileName}`,
                file,
                { maxWidth: isProfile ? 512 : 1920, quality: 0.8 }
            )

            setFormData({ ...formData, [type]: downloadURL })
        } catch (error) {
            console.error("Upload failed:", error)
        } finally {
            if (isProfile) setUploadingProfile(false)
            else setUploadingCover(false)
        }
    }

    const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || [])
        e.target.value = ''

        const galleryImages = formData.galleryImages || []
        const remainingSlots = VENDOR_GALLERY_LIMIT - galleryImages.length
        if (remainingSlots <= 0) {
            toast.error(`A vendor gallery can contain up to ${VENDOR_GALLERY_LIMIT} images.`)
            return
        }

        const files = selectedFiles.slice(0, remainingSlots)
        if (selectedFiles.length > remainingSlots) {
            toast.warning(`Only ${remainingSlots} image${remainingSlots === 1 ? '' : 's'} uploaded to stay within the ${VENDOR_GALLERY_LIMIT}-image limit.`)
        }
        if (files.length === 0) return

        setUploadingGallery(true)
        setGalleryUploadProgress({ completed: 0, total: files.length })
        const uploadedImages: string[] = []
        let failedUploads = 0

        for (const [index, file] of files.entries()) {
            try {
                const uniqueName = `${Date.now()}_${index}_${crypto.randomUUID()}_${file.name}`
                const downloadURL = await uploadImage(
                    `vendors/${vendorId}/gallery/${uniqueName}`,
                    file,
                    {
                        maxWidth: 1920,
                        quality: 0.8,
                        cacheControl: 'public,max-age=31536000,immutable',
                    },
                )
                uploadedImages.push(downloadURL)
            } catch (error) {
                failedUploads += 1
                console.error('Gallery upload failed:', error)
            } finally {
                setGalleryUploadProgress((current) => ({
                    ...current,
                    completed: current.completed + 1,
                }))
            }
        }

        if (uploadedImages.length > 0) {
            setFormData({
                ...formData,
                galleryImages: [...galleryImages, ...uploadedImages],
            })
            toast.success(`${uploadedImages.length} gallery image${uploadedImages.length === 1 ? '' : 's'} uploaded. Save settings to publish.`)
        }
        if (failedUploads > 0) {
            toast.error(`${failedUploads} gallery image${failedUploads === 1 ? '' : 's'} failed to upload.`)
        }
        setUploadingGallery(false)
        setGalleryUploadProgress({ completed: 0, total: 0 })
    }

    const moveGalleryImage = (index: number, direction: -1 | 1) => {
        const galleryImages = [...(formData.galleryImages || [])]
        const targetIndex = index + direction
        if (targetIndex < 0 || targetIndex >= galleryImages.length) return

        const current = galleryImages[index]
        galleryImages[index] = galleryImages[targetIndex]
        galleryImages[targetIndex] = current
        setFormData({ ...formData, galleryImages })
    }

    const removeGalleryImage = (imageUrl: string) => {
        setFormData({
            ...formData,
            galleryImages: (formData.galleryImages || []).filter((current) => current !== imageUrl),
        })
        if (!savedGalleryImages.includes(imageUrl)) {
            void deleteGalleryImages([imageUrl])
        }
    }

    return (
        <div className="space-y-8">
            <details className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <summary className="cursor-pointer font-semibold text-slate-800">Image size guidelines</summary>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    <li><strong>Logo:</strong> 512 × 512 px, square; transparent PNG or WebP works best.</li>
                    <li><strong>Cover:</strong> 1200 × 800 px, landscape (3:2); keep key content centered because the app crops to fit.</li>
                    <li><strong>Gallery:</strong> 1200 × 800 px, landscape (3:2); up to {VENDOR_GALLERY_LIMIT} menu, product, or venue photos.</li>
                    <li><strong>Home banner:</strong> 1080 × 460 px; link it to this vendor in Home content → Partner banners. The phone layout crops the sides, so keep text and logos near the center.</li>
                    <li><strong>Featured showcase:</strong> hero 1200 × 750 px (16:10); brand tiles 512 × 512 px, square. Set these in Home content → Featured showcase.</li>
                </ul>
                <p className="mt-3 text-xs text-slate-500">Uploads are converted to WebP. These are recommended source sizes, not upload restrictions.</p>
            </details>
            <section className="space-y-3 rounded-xl border bg-white p-5">
                <div><Label htmlFor="vendor-card-label" className="text-base font-semibold">Vendor card label</Label><p className="mt-1 text-sm text-muted-foreground">One optional badge for this vendor in New Deals, Trending, search and category listings. It stays the same across all offers.</p></div>
                <Input id="vendor-card-label" maxLength={32} value={formData.cardLabel || ''} onChange={event => setFormData({ ...formData, cardLabel: event.target.value })} placeholder="e.g. Student favourite" className="max-w-md" />
                <p className="text-xs text-muted-foreground">Leave blank to hide the badge. Offer savings are managed separately in Offers.</p>
            </section>
            <section className="flex items-start gap-3 rounded-xl border bg-white p-5">
                <Checkbox id="vendor-suggested-offers" checked={formData.isSuggested === true} onCheckedChange={checked => setFormData({ ...formData, isSuggested: checked === true })} />
                <div><Label htmlFor="vendor-suggested-offers" className="text-base font-semibold">Show in suggested offers</Label><p className="mt-1 text-sm text-muted-foreground">Include this vendor’s active offers when a mobile search has no matches. Only active vendors with a current offer appear.</p></div>
            </section>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="vendor-phone">Phone</Label><Input id="vendor-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+974 5000 0000" value={formData.phoneNumber || ''} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="vendor-website">Website</Label><Input id="vendor-website" placeholder="https://example.com" value={formData.website || ''} onChange={e => setFormData({ ...formData, website: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="vendor-instagram">Instagram</Label><Input id="vendor-instagram" placeholder="https://instagram.com/yourrestaurant" value={formData.instagramUrl || ''} onChange={e => setFormData({ ...formData, instagramUrl: e.target.value })} /></div>
            </div>
            <div className="flex flex-wrap gap-8">
                <div className="space-y-4">
                    <Label className="text-base font-semibold text-slate-700">Vendor logo</Label>
                    <p className="-mt-3 text-xs text-slate-500">512 × 512 px · used for this vendor and all its offers</p>
                    <div className="relative w-36 h-36">
                        <input
                            type="file"
                            ref={profileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => handleFileChange(e, 'profilePicture')}
                        />
                        <div className={`w-full h-full rounded-[2.5rem] flex items-center justify-center overflow-hidden transition-all ${formData.profilePicture ? 'bg-transparent' : 'bg-slate-50 border border-slate-100 shadow-sm'}`}>
                            {uploadingProfile ? (
                                <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                            ) : formData.profilePicture ? (
                                <img
                                    key={formData.profilePicture}
                                    src={formData.profilePicture}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <Upload className="w-8 h-8 text-slate-300" />
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => profileInputRef.current?.click()}
                            disabled={uploadingProfile}
                            className="absolute -top-1 -right-1 p-2 bg-white rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all disabled:opacity-50"
                        >
                            <Upload className="w-4 h-4 text-slate-500" />
                        </button>
                    </div>
                </div>

                <div className="space-y-4 flex-1">
                    <Label className="text-base font-semibold text-slate-700">Cover Image</Label>
                    <p className="-mt-3 text-xs text-slate-500">1200 × 800 px · landscape; centered content avoids app cropping</p>
                    <div className="relative h-36 w-full max-w-2xl group">
                        <input
                            type="file"
                            ref={coverInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => handleFileChange(e, 'coverImage')}
                        />
                        <div className={`w-full h-full rounded-[2.5rem] flex items-center justify-center overflow-hidden transition-all group-hover:border-slate-200 ${formData.coverImage ? 'bg-transparent' : 'bg-slate-50 border border-slate-100 shadow-sm'}`}>
                            {uploadingCover ? (
                                <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                            ) : formData.coverImage ? (
                                <img
                                    key={formData.coverImage}
                                    src={formData.coverImage}
                                    alt="Cover"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <Upload className="w-8 h-8 text-slate-300" />
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => coverInputRef.current?.click()}
                            disabled={uploadingCover}
                            className="absolute -top-1 -right-1 p-2 bg-white rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 transition-all disabled:opacity-50"
                        >
                            <Upload className="w-4 h-4 text-slate-500" />
                        </button>
                        <Button
                            variant="secondary"
                            type="button"
                            className="absolute bottom-4 right-4 bg-white/95 hover:bg-white text-xs h-8 rounded-full shadow-sm"
                            onClick={() => coverInputRef.current?.click()}
                            disabled={uploadingCover}
                        >
                            {uploadingCover ? 'Uploading...' : 'Change Cover'}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="space-y-4 border-t border-slate-100 pt-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <Label className="text-base font-semibold text-slate-700">Vendor Gallery</Label>
                        <p className="mt-1 text-sm text-slate-500">
                            1200 × 800 px each · landscape photos of menus, products, and the venue. {(formData.galleryImages || []).length}/{VENDOR_GALLERY_LIMIT} images.
                        </p>
                    </div>
                    <input
                        type="file"
                        ref={galleryInputRef}
                        className="hidden"
                        accept="image/*"
                        multiple
                        onChange={handleGalleryUpload}
                    />
                    <Button
                        type="button"
                        variant="secondary"
                        className="gap-2 rounded-xl"
                        onClick={() => galleryInputRef.current?.click()}
                        disabled={uploadingGallery || (formData.galleryImages || []).length >= VENDOR_GALLERY_LIMIT}
                    >
                        {uploadingGallery ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {uploadingGallery
                            ? `Uploading ${galleryUploadProgress.completed}/${galleryUploadProgress.total}`
                            : 'Upload Images'}
                    </Button>
                </div>

                {(formData.galleryImages || []).length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                        {(formData.galleryImages || []).map((imageUrl, index) => (
                            <div key={imageUrl} className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
                                <img
                                    src={imageUrl}
                                    alt={`Vendor gallery ${index + 1}`}
                                    className="aspect-[4/3] w-full object-cover"
                                    loading="lazy"
                                />
                                <div className="flex items-center justify-between gap-1 p-2">
                                    <span className="px-1 text-xs font-semibold text-slate-500">{index + 1}</span>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => moveGalleryImage(index, -1)}
                                            disabled={index === 0}
                                            aria-label="Move image left"
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => moveGalleryImage(index, 1)}
                                            disabled={index === (formData.galleryImages || []).length - 1}
                                            aria-label="Move image right"
                                        >
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                                            onClick={() => removeGalleryImage(imageUrl)}
                                            aria-label="Remove image"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        disabled={uploadingGallery}
                        className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50"
                    >
                        <Upload className="h-6 w-6 text-slate-400" />
                        Upload vendor gallery images
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                {/* Brand Name English */}
                <div className="space-y-4">
                    <Label className="text-base font-semibold text-slate-700">Brand Name (English)</Label>
                    <Input
                        placeholder="Tim Hortons"
                        value={formData.name || ""}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="bg-slate-50 border-none ring-0 focus-visible:ring-1 focus-visible:ring-blue-400 h-14 rounded-2xl px-5 text-sm"
                    />
                </div>


                {/* Short Description English */}
                <div className="space-y-4">
                    <Label className="text-base font-semibold text-slate-700">Short Description (English)</Label>
                    <Input
                        placeholder="Best coffee in town"
                        value={formData.shortDescription || ""}
                        onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                        className="bg-slate-50 border-none ring-0 focus-visible:ring-1 focus-visible:ring-blue-400 h-14 rounded-2xl px-5 text-sm"
                    />
                </div>


                {/* Main Categories */}
                <div className="space-y-4">
                    <Label className="text-base font-semibold text-slate-700">Main Categories</Label>
                    <p className="-mt-3 text-sm text-muted-foreground">Select every category this vendor belongs to. The first selected category is the primary category.</p>
                    <div className="flex flex-wrap gap-2">
                        {categories.map(category => {
                            const selected = categoryIds.includes(category.id)
                            return <label key={category.id} className="flex cursor-pointer items-center gap-2 rounded-xl border bg-slate-50 px-3 py-2 text-sm">
                                <input type="checkbox" checked={selected} disabled={selected && categoryIds.length === 1} onChange={() => setCategories(selected ? categoryIds.filter(id => id !== category.id) : [...categoryIds, category.id])} />
                                {category.nameEnglish}{categoryIds[0] === category.id ? ' · Primary' : ''}
                            </label>
                        })}
                    </div>
                </div>

                {/* Subcategories */}
                <div className="space-y-4">
                    <Label className="text-base font-semibold text-slate-700">Subcategories</Label>
                    <Select
                        value=""
                        onValueChange={(value) => {
                            const current = formData.subcategory || []
                            if (!current.includes(value)) {
                                setFormData({ ...formData, subcategory: [...current, value] })
                            }
                        }}
                        disabled={!formData.mainCategory}
                    >
                        <SelectTrigger className="w-full bg-slate-50 border-none h-14 rounded-2xl px-5 text-sm">
                            <SelectValue placeholder={formData.mainCategory ? "Add a subcategory" : "Select a main category first"} />
                        </SelectTrigger>
                        <SelectContent>
                            {availableSubcategories
                                .filter(sub => !(formData.subcategory || []).includes(sub.nameEnglish))
                                .map((sub) => (
                                    <SelectItem key={sub.nameEnglish} value={sub.nameEnglish}>
                                        {sub.nameEnglish}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                    {(formData.subcategory || []).length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            {(formData.subcategory || []).map((sub: string) => {
                                const subData = availableSubcategories.find(s => s.nameEnglish === sub)
                                return (
                                    <Badge key={sub} variant="secondary" className="px-3 py-1.5 text-sm gap-1.5 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200">
                                        <Tag className="w-3 h-3" />
                                        {subData ? subData.nameEnglish : sub}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormData({
                                                    ...formData,
                                                    subcategory: (formData.subcategory || []).filter((s: string) => s !== sub)
                                                })
                                            }}
                                            className="ml-1 hover:text-red-500 transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </Badge>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Search Tokens */}
                <div className="space-y-4 md:col-span-2">
                    <Label className="text-base font-semibold text-slate-700">Search Tokens</Label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Type a keyword and press Enter"
                            value={tokenInput}
                            onChange={(e) => setTokenInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault()
                                    const token = tokenInput.trim().toLowerCase()
                                    const current = formData.searchTokens || []
                                    if (token && !current.includes(token)) {
                                        setFormData({ ...formData, searchTokens: [...current, token] })
                                    }
                                    setTokenInput("")
                                }
                            }}
                            className="bg-slate-50 border-none ring-0 focus-visible:ring-1 focus-visible:ring-blue-400 h-14 rounded-2xl px-5 text-sm flex-1"
                        />
                        <Button
                            type="button"
                            variant="secondary"
                            className="h-14 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600"
                            onClick={() => {
                                const token = tokenInput.trim().toLowerCase()
                                const current = formData.searchTokens || []
                                if (token && !current.includes(token)) {
                                    setFormData({ ...formData, searchTokens: [...current, token] })
                                }
                                setTokenInput("")
                            }}
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                    {(formData.searchTokens || []).length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            {(formData.searchTokens || []).map((token: string) => (
                                <Badge key={token} variant="secondary" className="px-3 py-1.5 text-sm gap-1.5 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200">
                                    <Tag className="w-3 h-3" />
                                    {token}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFormData({
                                                ...formData,
                                                searchTokens: (formData.searchTokens || []).filter((t: string) => t !== token)
                                            })
                                        }}
                                        className="ml-1 hover:text-red-500 transition-colors"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>

            </div >

        </div >
    )
}
