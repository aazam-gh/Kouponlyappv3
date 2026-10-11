import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SquarePen, Plus, Loader2, ArrowLeft, Check, Trash2 } from 'lucide-react'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { db } from '@/firebase/config'
import { doc, updateDoc } from 'firebase/firestore'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { vendorQueryOptions, type EmbeddedOffer } from '@/queries'
import { refreshVendorList } from '@/lib/vendorList'
import { uploadImage } from '@/lib/upload'

export function generateSearchTokens({
    name,
    mainCategory,
    subcategory,
    offerTitles,
}: {
    name?: string;
    mainCategory?: string;
    subcategory?: string[];
    offerTitles?: string[];
}): string[] {
    const tokens = new Set<string>();

    const tokenize = (text?: string) => {
        if (!text) return;
        const words = text.toLowerCase().split(/[\s\-_,.]+/);

        words.forEach(word => {
            if (!word) return;
            tokens.add(word);

            // English specific
            if (word.includes("'")) {
                tokens.add(word.replace(/'/g, ""));
                tokens.add(word.split("'")[0]);
            }

        });
    };

    tokenize(name);
    tokenize(mainCategory);
    if (subcategory) subcategory.forEach(tokenize);
    if (offerTitles) offerTitles.forEach(tokenize);

    return Array.from(tokens);
}

interface OffersSettingsProps {
    vendorId: string | undefined
}

function makeVendorLogo(name: string): File {
    const initials = name.trim().split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase()
    const safeName = name.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!)
    const color = ({
        Starbucks: '#00704a', KFC: '#e4002b', 'Burger King': '#d62300', 'Kochi Marriott': '#8a714c',
        IndiGo: '#172b85', 'PVR Cinemas': '#ed1c24', Wonderla: '#e61e2b', Croma: '#6d2077',
        Chicking: '#e31837', Cinepolis: '#003da5', Nykaa: '#fc2779', Decathlon: '#0072ce', Westside: '#302c2b',
    } as Record<string, string>)[name] || '#17894f'
    const fontSize = name.length > 13 ? 28 : name.length > 9 ? 34 : 40
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="72" fill="${color}"/><circle cx="256" cy="190" r="91" fill="#fff"/><text x="256" y="217" text-anchor="middle" font-family="Outfit,sans-serif" font-size="76" font-weight="700" fill="${color}">${initials}</text><text x="256" y="353" text-anchor="middle" font-family="Outfit,sans-serif" font-size="${fontSize}" font-weight="700" fill="#fff">${safeName}</text><text x="256" y="407" text-anchor="middle" font-family="Outfit,sans-serif" font-size="17" letter-spacing="5" fill="#ffffffcc">KOUPONLY OFFER</text></svg>`
    return new File([svg], `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-offer-logo.svg`, { type: 'image/svg+xml' })
}

export function OffersSettings({ vendorId }: OffersSettingsProps) {
    const queryClient = useQueryClient()
    const [isCreating, setIsCreating] = useState(false)
    const [editingIndex, setEditingIndex] = useState<number | null>(null)
    const [isUploadingImage, setIsUploadingImage] = useState(false)

    // Form State
    const [formData, setFormData] = useState<Partial<EmbeddedOffer>>({
        discountType: 'percentage',
        discountValue: 0,
        currency: 'INR',
        active: true,
        redemptionMode: 'inStore',
    })

    // Reset form when entering Create mode
    useEffect(() => {
        if (isCreating) {
            setFormData({
                discountType: 'percentage',
                discountValue: 0,
                currency: 'INR',
                active: true,
                redemptionMode: 'inStore',
            })
        }
    }, [isCreating])

    // Populate form when entering Edit mode
    useEffect(() => {
        if (editingIndex !== null) {
            const offers = vendor?.offers || []
            if (offers[editingIndex]) {
                const offer = offers[editingIndex]
                setFormData({ ...offer, cardLabels: offer.cardLabels ?? (offer.cardLabel ? [offer.cardLabel] : []) })
            }
        }
    }, [editingIndex])

    const { data: vendor } = useSuspenseQuery(vendorQueryOptions(vendorId!))
    const offers = vendor?.offers || []

    const saveMutation = useMutation({
        mutationFn: async (data: Partial<EmbeddedOffer>) => {
            if (!vendorId) throw new Error("Vendor ID is missing")
            if (!data.titleEn?.trim()) throw new Error('Enter an offer title before saving.')
            if (data.startsAt && data.endsAt && Date.parse(data.endsAt) <= Date.parse(data.startsAt)) {
                throw new Error('The end date must be later than the start date.')
            }

            const offer: EmbeddedOffer = {
                id: data.id,
                titleEn: data.titleEn.trim(),
                descriptionEn: data.descriptionEn,
                imageUrl: data.imageUrl,
                discountType: data.discountType || 'percentage',
                ...(data.discountType !== 'buy1get1' && { discountValue: data.discountValue || 0 }),
                currency: data.currency || 'INR',
                savingLabel: data.savingLabel?.trim(),
                cardLabels: (data.cardLabels ?? (data.cardLabel ? [data.cardLabel] : [])).map(label => label.trim()).filter(Boolean).slice(0, 3),
                offerValue: data.offerValue ?? data.discountValue ?? 0,
                startsAt: data.startsAt || undefined,
                endsAt: data.endsAt || undefined,
                termsEn: data.termsEn?.trim(),
                redemptionInstructionsEn: data.redemptionInstructionsEn?.trim(),
                active: data.active ?? true,
                redemptionMode: 'inStore',
            }

            let updatedOffers: EmbeddedOffer[]
            if (editingIndex !== null) {
                updatedOffers = [...offers]
                updatedOffers[editingIndex] = offer
            } else {
                updatedOffers = [...offers, offer]
            }

            const allTitles = updatedOffers.map(o => o.titleEn).filter(Boolean) as string[]

            await updateDoc(doc(db, 'vendors', vendorId), {
                offers: updatedOffers,
                searchTokens: generateSearchTokens({
                    name: vendor?.name,
                    mainCategory: vendor?.mainCategory,
                    subcategory: vendor?.subcategory,
                    offerTitles: allTitles,
                }),
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendor', vendorId] })
            toast.success(editingIndex !== null ? 'Offer updated' : 'Offer created')
            setIsCreating(false)
            setEditingIndex(null)
            void refreshVendorList()
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : 'Failed to save offer')
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (index: number) => {
            if (!vendorId) throw new Error("Vendor ID is missing")

            const updatedOffers = offers.filter((_, i) => i !== index)
            const allTitles = updatedOffers.map(o => o.titleEn).filter(Boolean) as string[]

            await updateDoc(doc(db, 'vendors', vendorId), {
                offers: updatedOffers,
                searchTokens: generateSearchTokens({
                    name: vendor?.name,
                    mainCategory: vendor?.mainCategory,
                    subcategory: vendor?.subcategory,
                    offerTitles: allTitles,
                }),
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendor', vendorId] })
            toast.success('Offer deleted')
            setEditingIndex(null)
            void refreshVendorList()
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : 'Failed to delete offer')
        }
    })


    if (isCreating || editingIndex !== null) {
        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full h-10 w-10 border hover:bg-slate-100"
                            onClick={() => {
                                setIsCreating(false)
                                setEditingIndex(null)
                            }}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-3xl font-bold tracking-tight">
                            <span className="text-slate-400 font-medium">{vendor?.name || 'Vendor'} / </span>
                            {isCreating ? 'Create new Offer' : 'Manage Offer'}
                        </h1>
                    </div>
                    {editingIndex !== null && (
                        <Button
                            variant="destructive"
                            className="rounded-full px-6 h-10 bg-[#EF4444] hover:bg-[#DC2626] font-medium text-white flex items-center gap-2"
                            onClick={() => {
                                if (confirm('Are you sure you want to delete this offer?')) {
                                    deleteMutation.mutate(editingIndex!)
                                }
                            }}
                            disabled={deleteMutation.isPending}
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete Offer
                        </Button>
                    )}
                </div>

                {/* Form Fields - 2 Columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Titles & Descriptions */}
                    <div className="space-y-6">
                        {/* Titles */}
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="titleEn">Title (English)</Label>
                                <Input
                                    id="titleEn"
                                    value={formData.titleEn || ''}
                                    onChange={e => setFormData(prev => ({ ...prev, titleEn: e.target.value }))}
                                    placeholder="Ex: Summer Sale"
                                    className="bg-slate-50 h-12"
                                />
                            </div>
                        </div>

                        {/* Descriptions */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="descEn">Description (English)</Label>
                                <Textarea
                                    id="descEn"
                                    value={formData.descriptionEn || ''}
                                    onChange={e => setFormData(prev => ({ ...prev, descriptionEn: e.target.value }))}
                                    placeholder="Brief description of the offer..."
                                    className="bg-slate-50 min-h-[100px]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Discount Settings */}
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <Label htmlFor="offerImage">Offer logo</Label>
                            <div className="flex items-center gap-4">
                                {formData.imageUrl ? (
                                    <img src={formData.imageUrl} alt="Offer logo preview" className="h-16 w-16 rounded-xl border bg-white object-contain p-1" />
                                ) : (
                                    <div className="h-16 w-16 rounded-xl border bg-white text-xs text-slate-400 flex items-center justify-center">No logo</div>
                                )}
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Input
                                            id="offerImage"
                                            type="file"
                                            accept="image/*"
                                            disabled={isUploadingImage}
                                            className="max-w-xs bg-white"
                                            onChange={async e => {
                                                const file = e.target.files?.[0]
                                                if (!file || !vendorId) return
                                                setIsUploadingImage(true)
                                                try {
                                                    const path = `vendors/${vendorId}/offers/offer-${editingIndex ?? 'new'}`
                                                    const imageUrl = await uploadImage(path, file, { maxWidth: 512, quality: 0.9 })
                                                    setFormData(prev => ({ ...prev, imageUrl }))
                                                    toast.success('Offer logo uploaded')
                                                } catch (error) {
                                                    toast.error(error instanceof Error ? error.message : 'Failed to upload offer logo')
                                                } finally {
                                                    setIsUploadingImage(false)
                                                    e.target.value = ''
                                                }
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={isUploadingImage}
                                            onClick={async () => {
                                                if (!vendorId) return
                                                setIsUploadingImage(true)
                                                try {
                                                    const path = `vendors/${vendorId}/offers/offer-${editingIndex ?? 'new'}`
                                                    const imageUrl = await uploadImage(path, makeVendorLogo(vendor?.name || 'Vendor'), { maxWidth: 512, quality: 0.9 })
                                                    setFormData(prev => ({ ...prev, imageUrl }))
                                                    toast.success('Vendor offer logo created and uploaded')
                                                } catch (error) {
                                                    toast.error(error instanceof Error ? error.message : 'Failed to create offer logo')
                                                } finally {
                                                    setIsUploadingImage(false)
                                                }
                                            }}
                                        >
                                            Create vendor logo
                                        </Button>
                                    </div>
                                    {isUploadingImage && <p className="mt-1 text-xs text-slate-500">Uploading logo…</p>}
                                </div>
                            </div>
                        </div>
                        {/* Discount Settings */}
                        <div className="grid grid-cols-2 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="space-y-2">
                                <Label>Discount Type</Label>
                                <Select
                                    value={formData.discountType}
                                    onValueChange={(val: any) => setFormData(prev => ({ ...prev, discountType: val }))}
                                >
                                    <SelectTrigger className="bg-white h-11">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                                        <SelectItem value="amount">Fixed Amount</SelectItem>
                                        <SelectItem value="buy1get1">Buy 1 Get 1</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {formData.discountType !== 'buy1get1' && (
                                <div className="space-y-2">
                                    <Label>Discount Value</Label>
                                    <Input
                                        type="number"
                                        value={formData.discountValue}
                                        onChange={e => setFormData(prev => ({ ...prev, discountValue: parseFloat(e.target.value) }))}
                                        className="bg-white h-11"
                                        placeholder="0"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3 md:col-span-2">
                                <div>
                                    <Label>Vendor card labels (up to 3)</Label>
                                    <p className="mt-1 text-xs text-slate-500">Shown stacked on the Home screen’s All Vendors cards. The first label also appears in New Deals, Trending, search, and category listings.</p>
                                </div>
                                {[0, 1, 2].map(index => (
                                    <div key={index} className="space-y-2">
                                        <Label htmlFor={`cardLabel-${index}`}>Label {index + 1}</Label>
                                        <Input
                                            id={`cardLabel-${index}`}
                                            value={formData.cardLabels?.[index] || ''}
                                            onChange={e => setFormData(prev => {
                                                const cardLabels = [...(prev.cardLabels ?? [])]
                                                cardLabels[index] = e.target.value
                                                return { ...prev, cardLabels }
                                            })}
                                            placeholder={index === 0 ? 'e.g. Student Combos' : 'Optional'}
                                            maxLength={32}
                                            className="bg-slate-50 h-11"
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="savingLabel">Mobile offer label</Label>
                                <Input id="savingLabel" value={formData.savingLabel || ''} onChange={e => setFormData(prev => ({ ...prev, savingLabel: e.target.value }))} placeholder="Save up to ₹480" className="bg-slate-50 h-11" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="offerValue">Saving value (₹)</Label>
                                <Input id="offerValue" type="number" min="0" value={formData.offerValue ?? ''} onChange={e => setFormData(prev => ({ ...prev, offerValue: e.target.value === '' ? undefined : Number(e.target.value) }))} placeholder="480" className="bg-slate-50 h-11" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="startsAt">Starts (your local time)</Label>
                                <Input id="startsAt" type="datetime-local" value={formData.startsAt ? format(new Date(formData.startsAt), "yyyy-MM-dd'T'HH:mm") : ''} onChange={e => setFormData(prev => ({ ...prev, startsAt: e.target.value ? new Date(e.target.value).toISOString() : undefined }))} className="bg-slate-50 h-11" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="endsAt">Ends (your local time)</Label>
                                <Input id="endsAt" type="datetime-local" value={formData.endsAt ? format(new Date(formData.endsAt), "yyyy-MM-dd'T'HH:mm") : ''} onChange={e => setFormData(prev => ({ ...prev, endsAt: e.target.value ? new Date(e.target.value).toISOString() : undefined }))} className="bg-slate-50 h-11" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="termsEn">Terms and conditions</Label>
                                <Textarea id="termsEn" value={formData.termsEn || ''} onChange={e => setFormData(prev => ({ ...prev, termsEn: e.target.value }))} placeholder="Add exclusions, limits, or booking requirements" className="bg-slate-50 min-h-[80px]" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="redemptionInstructionsEn">How to redeem</Label>
                                <Textarea id="redemptionInstructionsEn" value={formData.redemptionInstructionsEn || ''} onChange={e => setFormData(prev => ({ ...prev, redemptionInstructionsEn: e.target.value }))} placeholder="Tell customers what to show at checkout" className="bg-slate-50 min-h-[80px]" />
                            </div>
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                                <Checkbox checked={formData.active ?? true} onCheckedChange={checked => setFormData(prev => ({ ...prev, active: checked === true }))} />
                                Publish this offer in the mobile app
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-end gap-4 pt-8 border-t border-slate-100">
                    <Button
                        variant="ghost"
                        onClick={() => {
                            setIsCreating(false)
                            setEditingIndex(null)
                        }}
                        className="rounded-full px-6 h-12 text-base font-bold bg-slate-100 hover:bg-slate-200 text-black flex items-center gap-2"
                    >
                        <div className="w-3 h-3 rounded-full bg-slate-400" />
                        Cancel
                    </Button>
                    <Button
                        onClick={() => saveMutation.mutate(formData)}
                        disabled={saveMutation.isPending}
                        className={`rounded-full px-8 h-12 text-base font-bold text-white shadow-lg flex items-center gap-2 ${editingIndex !== null
                            ? 'bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 shadow-purple-200'
                            : 'bg-brand-green hover:bg-brand-green/90 shadow-green-200'
                            }`}
                    >
                        {saveMutation.isPending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <div className="bg-white/20 rounded-[4px] p-0.5">
                                    <Check className="w-3 h-3 text-white" strokeWidth={4} />
                                </div>
                                {editingIndex !== null ? 'Save Changes' : 'Create Offer'}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-wrap gap-8 items-start py-4 overflow-x-auto pb-8">
            {offers?.map((offer, index) => (
                <div key={index} className="flex items-center gap-6">
                    <Card className="flex flex-col w-[340px] h-[300px] rounded-[32px] border-none shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white p-0 overflow-hidden group transition-all duration-300 hover:shadow-[0_20px_40px_rgba(24,184,82,0.1)] relative">
                        {/* Discount Badge */}
                        <div className="h-[80px] w-full bg-slate-50 relative flex items-center justify-center">
                            <span className="text-2xl font-bold text-brand-green">
                                {offer.discountType === 'buy1get1' ? 'Buy 1 Get 1' : offer.discountType === 'percentage' ? `${offer.discountValue}% OFF` : `${offer.currency === 'INR' ? '₹' : '$'}${offer.discountValue} OFF`}
                            </span>
                        </div>

                        <div className="flex flex-col p-6 flex-grow">
                            <h3 className="text-xl font-bold text-[#1a1a1a] leading-tight mb-2 line-clamp-1">
                                {offer.titleEn || 'Untitled Offer'}
                            </h3>
                            <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 mb-4">
                                {offer.descriptionEn || 'No description provided.'}
                            </p>

                            <Button
                                className="mt-auto w-full bg-brand-green hover:bg-brand-green/90 text-white rounded-xl py-5 text-[15px] font-bold gap-2 shadow-[0_4px_15px_rgba(24,184,82,0.3)] transition-all active:scale-[0.98]"
                                onClick={() => setEditingIndex(index)}
                            >
                                <SquarePen className="h-4 w-4" />
                                Manage Offer
                            </Button>
                        </div>
                    </Card>

                    {/* Visual Separator Handles */}
                    <div className="flex gap-[4px] h-full items-center">
                        <div className="w-[3px] h-10 bg-slate-200 rounded-full" />
                        <div className="w-[3px] h-10 bg-slate-200 rounded-full" />
                    </div>
                </div>
            ))}

            <Card className="flex flex-col items-center justify-between w-[340px] h-[300px] rounded-[32px] border-2 border-[#3b82f6] border-solid bg-white p-8 text-center transition-all shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                <div className="flex-grow flex flex-col items-center justify-center gap-6">
                    <div className="relative">
                        <div className="relative h-24 w-24 flex items-center justify-center">
                            {/* Custom Wavy Badge Icon */}
                            <svg viewBox="0 0 100 100" className="w-full h-full">
                                <path
                                    d="M50 5 L58 12 Q65 18 73 18 L82 18 Q90 18 90 27 L90 36 Q90 43 96 50 L96 50 Q90 57 90 64 L90 73 Q90 82 82 82 L73 82 Q65 82 58 88 L50 95 L42 88 Q35 82 27 82 L18 82 Q10 82 10 73 L10 64 Q10 57 4 50 L4 50 Q10 43 10 36 L10 27 Q10 18 18 18 L27 18 Q35 18 42 12 Z"
                                    fill="none"
                                    stroke="#18B852"
                                    strokeWidth="5"
                                    strokeLinejoin="round"
                                />
                                <path d="M40 60 L60 40 M42 42 A3 3 0 1 1 42 41.9 M58 58 A3 3 0 1 1 58 57.9" stroke="#18B852" strokeWidth="6" strokeLinecap="round" />
                            </svg>
                            <Plus className="absolute top-0 right-0 h-8 w-8 text-brand-green stroke-[3]" />
                            <Plus className="absolute bottom-1 left-2 h-6 w-6 text-brand-green stroke-[3]" />
                        </div>
                    </div>

                    <p className="text-slate-500 font-bold text-[15px] max-w-[200px] leading-relaxed italic">
                        Get more discounts for students Yallah Admin!
                    </p>
                </div>

                <Button
                    onClick={() => setIsCreating(true)}
                    className="w-full bg-brand-green hover:bg-brand-green/90 text-white rounded-[20px] py-7 text-[16px] font-bold shadow-[0_4px_15px_rgba(124,58,237,0.3)] transition-all active:scale-[0.98]"
                >
                    Create New Offer
                </Button>
            </Card>
        </div>
    )
}
