import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SquarePen, Plus, Loader2, ArrowLeft, Check, Trash2 } from 'lucide-react'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { db } from '@/firebase/config'
import { doc, updateDoc } from 'firebase/firestore'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { vendorQueryOptions, type EmbeddedOffer } from '@/queries'
import { refreshVendorList } from '@/lib/vendorList'
import { Link } from '@tanstack/react-router'

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

export function OffersSettings({ vendorId }: OffersSettingsProps) {
    const queryClient = useQueryClient()
    const [isCreating, setIsCreating] = useState(false)
    const [editingIndex, setEditingIndex] = useState<number | null>(null)

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
                setFormData({ ...offer })
            }
        }
    }, [editingIndex])

    const { data: vendor } = useSuspenseQuery(vendorQueryOptions(vendorId!))
    const offers = vendor?.offers || []

    const saveMutation = useMutation({
        mutationFn: async (data: Partial<EmbeddedOffer>) => {
            if (!vendorId) throw new Error("Vendor ID is missing")
            if (!data.titleEn?.trim()) throw new Error('Enter an offer title before saving.')
            if (!['buy1get1', 'free'].includes(data.discountType || '') && (!Number.isFinite(data.discountValue) || data.discountValue! < 0 || (data.discountType === 'percentage' && data.discountValue! > 100))) throw new Error('Enter a valid discount or exclusive price. Percentages must be between 0 and 100.');

            const offer: EmbeddedOffer = {
                ...(editingIndex !== null ? offers[editingIndex] : {}),
                id: data.id,
                titleEn: data.titleEn.trim(),
                descriptionEn: data.descriptionEn,
                discountType: data.discountType || 'percentage',
                discountValue: data.discountType === 'buy1get1' ? undefined : data.discountValue || 0,
                currency: data.currency || 'INR',
                savingLabel: data.savingLabel?.trim(),
                offerValue: data.offerValue ?? data.discountValue ?? 0,
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
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            aria-label="Back to offers"
                            size="icon"
                            className="rounded-full h-10 w-10 border hover:bg-slate-100"
                            onClick={() => {
                                setIsCreating(false)
                                setEditingIndex(null)
                            }}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h2 className="text-xl font-semibold">{isCreating ? 'Create offer' : 'Edit offer'}</h2>
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
                        <div className="rounded-xl border bg-secondary/50 p-4 text-sm text-muted-foreground">
                            All offers use this vendor’s logo and card label. <Link to="/admin/vendors/$vendorId/settings/branding" params={{ vendorId: vendorId! }} className="font-medium text-primary underline underline-offset-4">Edit vendor profile</Link>
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
                                        <SelectItem value="free">Free eligible item</SelectItem>
                                        <SelectItem value="combo">Combo price</SelectItem>
                                        <SelectItem value="fixed_price">Kouponly Exclusive Price</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {!['buy1get1', 'free'].includes(formData.discountType || '') && (
                                <div className="space-y-2">
                                    <Label>{['combo', 'fixed_price'].includes(formData.discountType || '') ? 'Kouponly Exclusive Price' : 'Discount Value'}</Label>
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
                            <div className="space-y-2">
                                <Label htmlFor="savingLabel">Mobile offer label</Label>
                                <Input id="savingLabel" value={formData.savingLabel || ''} onChange={e => setFormData(prev => ({ ...prev, savingLabel: e.target.value }))} placeholder="Save up to ₹480" className="bg-slate-50 h-11" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="offerValue">Saving value (₹)</Label>
                                <Input id="offerValue" type="number" min="0" value={formData.offerValue ?? ''} onChange={e => setFormData(prev => ({ ...prev, offerValue: e.target.value === '' ? undefined : Number(e.target.value) }))} placeholder="480" className="bg-slate-50 h-11" />
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
                <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-3 bg-white/95 py-4 pt-8 border-t border-slate-100">
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
                        className="rounded-xl bg-primary px-6 text-white hover:bg-primary/90"
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
        <section className="space-y-5 py-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-lg font-semibold">Offers</h2><p className="mt-1 text-sm text-muted-foreground">{offers.length} offers. Vendor branding applies to every offer.</p></div>
                <Button onClick={() => setIsCreating(true)}><Plus className="size-4" />Create offer</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                {offers.map((offer, index) => <Card key={offer.id || index} className="gap-0 rounded-xl border bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3"><span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-primary">
                        {offer.discountType === 'free' ? 'Free eligible item' : ['combo', 'fixed_price'].includes(offer.discountType) ? `Exclusive price ${offer.currency === 'INR' ? '₹' : offer.currency} ${offer.discountValue}` : offer.discountType === 'buy1get1' ? 'Buy 1 Get 1' : offer.discountType === 'percentage' ? `${offer.discountValue}% off` : `${offer.currency === 'INR' ? '₹' : offer.currency || 'INR'} ${offer.discountValue} off`}
                    </span><span className="text-xs text-muted-foreground">{offer.active === false ? 'Inactive' : 'Active'}</span></div>
                    <h3 className="text-lg font-semibold">{offer.titleEn || 'Untitled offer'}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{offer.descriptionEn || 'No description provided.'}</p>
                    <Button variant="outline" className="mt-5 w-fit" onClick={() => setEditingIndex(index)}><SquarePen className="size-4" />Edit offer</Button>
                </Card>)}
            </div>
            {!offers.length && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No offers yet. Create an offer to make this vendor available in the app.</div>}
        </section>
    )
}
