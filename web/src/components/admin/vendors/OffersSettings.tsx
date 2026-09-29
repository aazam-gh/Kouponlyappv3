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
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { vendorQueryOptions, type EmbeddedOffer } from '@/queries'
import { refreshVendorList } from '@/lib/vendorList'

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

            // Arabic specific normalization
            const normalizedAr = word
                .replace(/[\u064B-\u0652]/g, '') // Remove diacritics
                .replace(/[أإآ]/g, 'ا') // Normalize Alef
                .replace(/ة/g, 'ه') // Normalize Teh Marbuta
                .replace(/ى/g, 'ي'); // Normalize Alef Maksura

            if (normalizedAr !== word) {
                tokens.add(normalizedAr);
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
    })

    // Reset form when entering Create mode
    useEffect(() => {
        if (isCreating) {
            setFormData({
                discountType: 'percentage',
                discountValue: 0,
            })
        }
    }, [isCreating])

    // Populate form when entering Edit mode
    useEffect(() => {
        if (editingIndex !== null) {
            const offers = vendor?.offers || []
            if (offers[editingIndex]) {
                setFormData({ ...offers[editingIndex] })
            }
        }
    }, [editingIndex])

    const { data: vendor } = useSuspenseQuery(vendorQueryOptions(vendorId!))
    const offers = vendor?.offers || []

    const saveMutation = useMutation({
        mutationFn: async (data: Partial<EmbeddedOffer>) => {
            if (!vendorId) throw new Error("Vendor ID is missing")

            const offer: EmbeddedOffer = {
                titleEn: data.titleEn || '',
                titleAr: data.titleAr,
                descriptionEn: data.descriptionEn,
                descriptionAr: data.descriptionAr,
                discountType: data.discountType || 'percentage',
                ...(data.discountType !== 'buy1get1' && { discountValue: data.discountValue || 0 }),
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
        onError: () => {
            toast.error('Failed to save offer')
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
        onError: () => {
            toast.error('Failed to delete offer')
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <div className="space-y-2">
                                <Label htmlFor="titleAr">Title (Arabic)</Label>
                                <Input
                                    id="titleAr"
                                    value={formData.titleAr || ''}
                                    onChange={e => setFormData(prev => ({ ...prev, titleAr: e.target.value }))}
                                    placeholder="Ex: خصومات الصيف"
                                    dir="rtl"
                                    className="bg-slate-50 h-12 text-right"
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
                            <div className="space-y-2">
                                <Label htmlFor="descAr">Description (Arabic)</Label>
                                <Textarea
                                    id="descAr"
                                    value={formData.descriptionAr || ''}
                                    onChange={e => setFormData(prev => ({ ...prev, descriptionAr: e.target.value }))}
                                    placeholder="وصف مختصر للعرض..."
                                    dir="rtl"
                                    className="bg-slate-50 min-h-[100px] text-right"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Discount Settings */}
                    <div className="space-y-6">
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
                                {offer.discountType === 'buy1get1' ? 'Buy 1 Get 1' : offer.discountType === 'percentage' ? `${offer.discountValue}% OFF` : `$${offer.discountValue} OFF`}
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
