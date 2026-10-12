import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, Loader2, X, Tag, Plus, TrendingUp, ArrowLeft, ArrowRight, Trash2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
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

    const selectedCategory = categories.find(c => c.nameEnglish === formData.mainCategory)
    const availableSubcategories = selectedCategory?.subcategories || []

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
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="vendor-website">Website</Label><Input id="vendor-website" placeholder="https://example.com" value={formData.website || ''} onChange={e => setFormData({ ...formData, website: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="vendor-instagram">Instagram</Label><Input id="vendor-instagram" placeholder="https://instagram.com/yourrestaurant" value={formData.instagramUrl || ''} onChange={e => setFormData({ ...formData, instagramUrl: e.target.value })} /></div>
            </div>
            <div className="flex gap-8">
                <div className="space-y-4">
                    <Label className="text-base font-semibold text-slate-700">Profile Picture</Label>
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
                            Menu, food, and ambience photos. {(formData.galleryImages || []).length}/{VENDOR_GALLERY_LIMIT} images.
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


                {/* Main Category */}
                <div className="space-y-4">
                    <Label className="text-base font-semibold text-slate-700">Main Category</Label>
                    <Select
                        value={formData.mainCategory || ""}
                        onValueChange={(value) => setFormData({ ...formData, mainCategory: value, categoryId: categories.find(cat => cat.nameEnglish === value)?.id, subcategory: [] })}
                    >
                        <SelectTrigger className="w-full bg-slate-50 border-none h-14 rounded-2xl px-5 text-sm">
                            <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                            {categories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.nameEnglish}>
                                    {cat.nameEnglish}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
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

            {/* Vendor visibility */}
            <div className="space-y-6 pt-8 border-t border-slate-100">
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                        <Label htmlFor="vendorStatus">Mobile visibility</Label>
                        <Select value={formData.status || 'Inactive'} onValueChange={value => setFormData({ ...formData, status: value as 'Active' | 'Inactive' })}>
                            <SelectTrigger id="vendorStatus"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="newest">New deals priority</Label>
                        <Input id="newest" type="number" min="0" step="1" value={formData.newest ?? 0} onChange={e => setFormData({ ...formData, newest: Number(e.target.value) })} />
                        <p className="text-xs text-muted-foreground">Higher values appear first in New deals.</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="sortOrder">Catalogue order</Label>
                        <Input id="sortOrder" type="number" min="0" step="1" value={formData.sortOrder ?? 0} onChange={e => setFormData({ ...formData, sortOrder: Number(e.target.value) })} />
                        <p className="text-xs text-muted-foreground">Lower values appear first in the catalogue.</p>
                    </div>
                </div>
                <div className="flex items-center space-x-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                    <Checkbox
                        id="isTrending"
                        checked={formData.isTrending || false}
                        onCheckedChange={(checked) => setFormData({ ...formData, isTrending: !!checked })}
                        className="h-5 w-5 rounded-md border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-slate-400" />
                        <Label htmlFor="isTrending" className="text-base font-semibold text-slate-700 cursor-pointer">
                            Trending Vendor
                        </Label>
                    </div>
                </div>
            </div>
        </div >
    )
}
