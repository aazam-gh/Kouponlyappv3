import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SquarePen, Plus, Loader2, ArrowLeft, ArrowUp, ArrowDown, Check, Trash2, GripVertical } from 'lucide-react'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useState, useEffect, type ReactNode } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable'
import { restrictToParentElement } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { vendorQueryOptions, type EmbeddedOffer } from '@/queries'
import { Link } from '@tanstack/react-router'
import { updateVendor } from '@/lib/vendor-directory'

function toDateTimeLocal(value?: string) {
    if (!value) return ''
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return ''
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function fromDateTimeLocal(value: string) {
    return value ? new Date(value).toISOString() : undefined
}

function SortableOfferCard({ id, index, total, disabled, move, children }: { id: string; index: number; total: number; disabled: boolean; move: (from: number, to: number) => void; children: ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
    return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? 'relative z-10' : undefined}>
        <Card className={`gap-0 rounded-xl border bg-white p-5 shadow-sm ${isDragging ? 'shadow-lg' : ''}`}>
            <div className="mb-4 flex items-center gap-2">
                <Button {...attributes} {...listeners} variant="ghost" size="icon" disabled={disabled} className="size-8 shrink-0 cursor-grab touch-none" aria-label={`Drag offer ${index + 1}`}><GripVertical className="size-4" /></Button>
                <span className="mr-auto text-xs font-semibold text-muted-foreground">Offer {index + 1}</span>
                <Button variant="ghost" size="icon" disabled={disabled || index === 0} aria-label="Move offer up" onClick={() => move(index, index - 1)}><ArrowUp className="size-4" /></Button>
                <Button variant="ghost" size="icon" disabled={disabled || index === total - 1} aria-label="Move offer down" onClick={() => move(index, index + 1)}><ArrowDown className="size-4" /></Button>
            </div>
            {children}
        </Card>
    </div>
}

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
    const [validityType, setValidityType] = useState<'indefinite' | 'date_range'>('indefinite')

    // Form State
    const [formData, setFormData] = useState<Partial<EmbeddedOffer>>({
        discountType: 'percentage',
        discountValue: 0,
        currency: 'INR',
        redemptionMode: 'inStore',
    })

    // Reset form when entering Create mode
    useEffect(() => {
        if (isCreating) {
            setValidityType('indefinite')
            setFormData({
                discountType: 'percentage',
                discountValue: 0,
                currency: 'INR',
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
                setValidityType(offer.startsAt || offer.endsAt ? 'date_range' : 'indefinite')
            }
        }
    }, [editingIndex])

    const { data: vendor } = useSuspenseQuery(vendorQueryOptions(vendorId!))
    const offers = vendor?.offers || []
    const reorderSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

    const reorderMutation = useMutation({
        mutationFn: async (updatedOffers: EmbeddedOffer[]) => {
            if (!vendorId) throw new Error('Vendor ID is missing')
            await updateVendor(vendorId, { offers: updatedOffers })
            return updatedOffers
        },
        onMutate: async updatedOffers => {
            await queryClient.cancelQueries({ queryKey: ['vendor', vendorId] })
            const previous = queryClient.getQueryData(['vendor', vendorId])
            queryClient.setQueryData(['vendor', vendorId], (old: typeof vendor | undefined) => old ? { ...old, offers: updatedOffers } : old)
            return { previous }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendor', vendorId] })
            toast.success('Offer order saved')
        },
        onError: (error, _offers, context) => {
            if (context?.previous) queryClient.setQueryData(['vendor', vendorId], context.previous)
            toast.error(error instanceof Error ? error.message : 'Could not save offer order')
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['vendor', vendorId] }),
    })

    const moveOffer = (from: number, to: number) => {
        if (to < 0 || to >= offers.length || from === to || reorderMutation.isPending || !vendorId) return
        const stableOffers = offers.map((offer, index) => ({ ...offer, id: offer.id || `${vendorId}:embedded:${index + 1}` }))
        reorderMutation.mutate(arrayMove(stableOffers, from, to))
    }

    const handleOfferDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return
        const ids = offers.map((offer, index) => offer.id || `${vendorId}:offer:${index}`)
        const from = ids.indexOf(String(active.id))
        const to = ids.indexOf(String(over.id))
        if (from >= 0 && to >= 0) moveOffer(from, to)
    }

    const saveMutation = useMutation({
        mutationFn: async (data: Partial<EmbeddedOffer>) => {
            if (!vendorId) throw new Error("Vendor ID is missing")
            if (!data.titleEn?.trim()) throw new Error('Enter an offer title before saving.')
            if (!['buy1get1', 'free'].includes(data.discountType || '') && (!Number.isFinite(data.discountValue) || data.discountValue! < 0 || (data.discountType === 'percentage' && data.discountValue! > 100))) throw new Error('Enter a valid discount or exclusive price. Percentages must be between 0 and 100.');
            if (validityType === 'date_range' && (!data.startsAt || !data.endsAt || !Number.isFinite(Date.parse(data.startsAt)) || !Number.isFinite(Date.parse(data.endsAt)) || Date.parse(data.endsAt) <= Date.parse(data.startsAt))) throw new Error('Choose a valid start and end time. The end must be after the start.');

            const offer: EmbeddedOffer = {
                ...(editingIndex !== null ? offers[editingIndex] : {}),
                id: data.id,
                titleEn: data.titleEn.trim(),
                descriptionEn: data.descriptionEn,
                discountType: data.discountType || 'percentage',
                discountValue: data.discountType === 'buy1get1' ? undefined : data.discountValue || 0,
                currency: data.currency || 'INR',
                termsEn: data.termsEn?.trim(),
                redemptionInstructionsEn: data.redemptionInstructionsEn?.trim(),
                startsAt: validityType === 'date_range' ? data.startsAt : undefined,
                endsAt: validityType === 'date_range' ? data.endsAt : undefined,
                active: true,
                redemptionMode: 'inStore',
            }
            delete offer.savingLabel
            delete offer.offerValue

            let updatedOffers: EmbeddedOffer[]
            if (editingIndex !== null) {
                updatedOffers = [...offers]
                updatedOffers[editingIndex] = offer
            } else {
                updatedOffers = [...offers, offer]
            }

            const allTitles = updatedOffers.map(o => o.titleEn).filter(Boolean) as string[]

            await updateVendor(vendorId, {
                status: 'Active',
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

            await updateVendor(vendorId, {
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
                                        <SelectItem value="fixed_price">Exclusive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {!['buy1get1', 'free'].includes(formData.discountType || '') && (
                                <div className="space-y-2">
                                    <Label>{['combo', 'fixed_price'].includes(formData.discountType || '') ? 'Exclusive' : 'Discount Value'}</Label>
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
                        <div className="space-y-4 rounded-xl border border-slate-100 bg-white p-5">
                            <div className="space-y-2">
                                <Label>Offer validity</Label>
                                <Select value={validityType} onValueChange={(value: 'indefinite' | 'date_range') => {
                                    setValidityType(value)
                                    if (value === 'indefinite') setFormData(prev => ({ ...prev, startsAt: undefined, endsAt: undefined }))
                                }}>
                                    <SelectTrigger className="bg-white h-11"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="indefinite">Unlimited — always valid</SelectItem>
                                        <SelectItem value="date_range">Set start and end date/time</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {validityType === 'date_range' && <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="offerStartsAt">Starts</Label>
                                    <Input id="offerStartsAt" type="datetime-local" step="60" value={toDateTimeLocal(formData.startsAt)} onChange={e => setFormData(prev => ({ ...prev, startsAt: fromDateTimeLocal(e.target.value) }))} className="bg-slate-50 h-11" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="offerEndsAt">Ends</Label>
                                    <Input id="offerEndsAt" type="datetime-local" step="60" min={toDateTimeLocal(formData.startsAt)} value={toDateTimeLocal(formData.endsAt)} onChange={e => setFormData(prev => ({ ...prev, endsAt: fromDateTimeLocal(e.target.value) }))} className="bg-slate-50 h-11" />
                                </div>
                            </div>}
                            <p className="text-xs text-muted-foreground">Offers appear in the mobile app only during the selected date and time range.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="termsEn">Terms and conditions</Label>
                                <Textarea id="termsEn" value={formData.termsEn || ''} onChange={e => setFormData(prev => ({ ...prev, termsEn: e.target.value }))} placeholder="Add exclusions, limits, or booking requirements" className="bg-slate-50 min-h-[80px]" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="redemptionInstructionsEn">How to redeem</Label>
                                <Textarea id="redemptionInstructionsEn" value={formData.redemptionInstructionsEn || ''} onChange={e => setFormData(prev => ({ ...prev, redemptionInstructionsEn: e.target.value }))} placeholder="Tell customers what to show at checkout" className="bg-slate-50 min-h-[80px]" />
                            </div>
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

    if (!vendor) return <p className="py-8 text-center text-sm text-muted-foreground">Vendor not found.</p>

    return (
        <section className="space-y-5 py-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-lg font-semibold">Offers</h2><p className="mt-1 text-sm text-muted-foreground">{offers.length} offers. Vendor branding applies to every offer.</p></div>
                <Button onClick={() => setIsCreating(true)}><Plus className="size-4" />Create offer</Button>
            </div>
            <p className="text-sm text-muted-foreground">Drag offers or use the arrows to choose the order shown in the mobile app.</p>
            <DndContext sensors={reorderSensors} collisionDetection={closestCenter} modifiers={[restrictToParentElement]} onDragEnd={handleOfferDragEnd}>
                <SortableContext items={offers.map((offer, index) => offer.id || `${vendorId}:offer:${index}`)} strategy={rectSortingStrategy}>
                    <div className="grid gap-4 md:grid-cols-2">
                        {offers.map((offer, index) => <SortableOfferCard key={offer.id || `${vendorId}:${index}`} id={offer.id || `${vendorId}:offer:${index}`} index={index} total={offers.length} disabled={reorderMutation.isPending} move={moveOffer}>
                            <span className="w-fit rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-primary">
                                {offer.discountType === 'free' ? 'Free eligible item' : ['combo', 'fixed_price'].includes(offer.discountType) ? `Exclusive price ${offer.currency === 'INR' ? '₹' : offer.currency} ${offer.discountValue}` : offer.discountType === 'buy1get1' ? 'Buy 1 Get 1' : offer.discountType === 'percentage' ? `${offer.discountValue}% off` : `${offer.currency === 'INR' ? '₹' : offer.currency || 'INR'} ${offer.discountValue} off`}
                            </span>
                            <h3 className="mt-4 text-lg font-semibold">{offer.titleEn || 'Untitled offer'}</h3>
                            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{offer.descriptionEn || 'No description provided.'}</p>
                            <Button variant="outline" className="mt-5 w-fit" disabled={reorderMutation.isPending} onClick={() => setEditingIndex(index)}><SquarePen className="size-4" />Edit offer</Button>
                        </SortableOfferCard>)}
                    </div>
                </SortableContext>
            </DndContext>
            {!offers.length && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No offers yet. Create an offer to make this vendor available in the app.</div>}
        </section>
    )
}
