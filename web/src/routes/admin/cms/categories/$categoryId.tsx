import { useState, useRef, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
    ArrowLeft,
    ArrowUp,
    ArrowDown,
    Trash2,
    Loader2,
    PackagePlus,
    Image as ImageIcon,
    FolderOpen
} from 'lucide-react'
import { db } from '@/firebase/config'
import {
    doc,
    getDoc,
    updateDoc
} from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Category, SubCategory } from '@/types/categories'
import { uploadImage } from '@/lib/upload'

interface SubCategoryItemProps {
    sub: SubCategory
    index: number
    onDelete: (index: number) => void
    onUpdate: (index: number, updates: Partial<SubCategory>) => void
    onMove: (index: number, direction: 'up' | 'down') => void
    onImageClick: (index: number) => void
    uploadingSubId: number | null
    isLast: boolean
    isUpdating?: boolean
}

function SubCategoryItem({
    sub,
    index,
    onDelete,
    onUpdate,
    onMove,
    onImageClick,
    uploadingSubId,
    isLast,
    isUpdating
}: SubCategoryItemProps) {
    const [nameEnglish, setNameEnglish] = useState(sub.nameEnglish)
    const [nameArabic, setNameArabic] = useState(sub.nameArabic)

    useEffect(() => {
        setNameEnglish(sub.nameEnglish)
        setNameArabic(sub.nameArabic)
    }, [sub.nameEnglish, sub.nameArabic])

    const hasChanges = nameEnglish !== sub.nameEnglish || nameArabic !== sub.nameArabic

    return (
        <div className="flex flex-col gap-4 p-5 bg-[#F8F9F9] rounded-2xl border border-gray-100 shadow-sm group hover:border-purple-200 transition-all duration-300">
            <div className="flex gap-4 items-start">
                <div
                    className="relative w-20 h-20 rounded-xl overflow-hidden bg-white border border-gray-100 shadow-sm flex-shrink-0 cursor-pointer group-hover:scale-[1.05] transition-transform"
                    onClick={() => onImageClick(index)}
                >
                    {sub.imageUrl ? (
                        <img src={sub.imageUrl} className="w-full h-full object-cover" alt={sub.nameEnglish} />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-1">
                            <ImageIcon className="w-5 h-5" />
                            <span className="text-[9px] font-bold">Add Image</span>
                        </div>
                    )}
                    {uploadingSubId === index && (
                        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                        </div>
                    )}
                </div>
                <div className="flex-1 space-y-2.5">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">English Name</label>
                        <Input
                            value={nameEnglish}
                            onChange={(e) => setNameEnglish(e.target.value)}
                            className="h-9 rounded-xl bg-white border-gray-100 text-sm font-bold px-3 shadow-none focus:ring-1 focus:ring-purple-200"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1 text-right block">Arabic Name</label>
                        <Input
                            value={nameArabic}
                            dir="rtl"
                            onChange={(e) => setNameArabic(e.target.value)}
                            className="h-9 rounded-xl bg-white border-gray-100 text-sm font-bold px-3 shadow-none focus:ring-1 focus:ring-purple-200 text-right"
                        />
                    </div>
                </div>
            </div>

            <div className="flex gap-1.5">
                <Button
                    variant="outline"
                    className="flex-1 h-9 rounded-xl border-red-100 bg-red-50/50 hover:bg-red-50 text-red-500 text-xs font-bold gap-2 transition-colors"
                    onClick={() => onDelete(index)}
                >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>

                {hasChanges && (
                    <Button
                        className="flex-1 h-9 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold gap-2 transition-all shadow-md"
                        onClick={() => onUpdate(index, { nameEnglish, nameArabic })}
                        disabled={isUpdating}
                    >
                        {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Update Sub'}
                    </Button>
                )}

                <Button
                    variant="outline"
                    size="icon"
                    className="rounded-xl h-9 w-9 border-gray-100 bg-white text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                    onClick={() => onMove(index, 'up')}
                    disabled={index === 0}
                >
                    <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    className="rounded-xl h-9 w-9 border-gray-100 bg-white text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                    onClick={() => onMove(index, 'down')}
                    disabled={isLast}
                >
                    <ArrowDown className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

export const Route = createFileRoute('/admin/cms/categories/$categoryId')({
    component: ManageCategory,
})

function ManageCategory() {
    const { categoryId } = Route.useParams()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [uploadingCover, setUploadingCover] = useState(false)
    const [uploadingSubId, setUploadingSubId] = useState<number | null>(null)
    const [localCategory, setLocalCategory] = useState<Category | null>(null)

    const coverInputRef = useRef<HTMLInputElement>(null)
    const subInputRef = useRef<HTMLInputElement>(null)

    const categoryQuery = useQuery({
        queryKey: ['category', categoryId],
        queryFn: async () => {
            const docRef = doc(db, 'categories', categoryId)
            const docSnap = await getDoc(docRef)
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() } as Category
            }
            throw new Error('Category not found')
        },
        staleTime: 1000 * 60 * 5,
    })

    useEffect(() => {
        setLocalCategory(null)
    }, [categoryId])

    useEffect(() => {
        if (categoryQuery.data && !localCategory) {
            setLocalCategory(categoryQuery.data)
        }
    }, [categoryQuery.data, localCategory])

    const category = localCategory

    const updateCategoryMutation = useMutation({
        mutationFn: async (updates: Partial<Category>) => {
            const docRef = doc(db, 'categories', categoryId)
            await updateDoc(docRef, updates)
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['category', categoryId] })
            queryClient.invalidateQueries({ queryKey: ['categories'] })
            setLocalCategory(prev => prev ? { ...prev, ...variables } : null)
            toast.success('Changes saved successfully')
        },
        onError: (error) => {
            console.error('Error updating category:', error)
            toast.error('Update failed')
        }
    })

    const handleSaveChanges = () => {
        if (!localCategory) return
        const { id, ...updates } = localCategory
        updateCategoryMutation.mutate(updates)
    }

    const handleUpdateCategory = (updates: Partial<Category>) => {
        setLocalCategory(prev => prev ? { ...prev, ...updates } : null)
    }

    const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !category) return

        setUploadingCover(true)
        try {
            const downloadURL = await uploadImage(
                `categories/covers/${Date.now()}_${file.name}`,
                file,
                { maxWidth: 512, quality: 0.8 }
            )

            handleUpdateCategory({ imageUrl: downloadURL })
            toast.success('Cover image uploaded. Click Save to persist.')
        } catch (error) {
            console.error('Error uploading cover:', error)
            toast.error('Upload failed')
        } finally {
            setUploadingCover(false)
            if (coverInputRef.current) coverInputRef.current.value = ''
        }
    }

    const handleAddSubCategory = async () => {
        if (!category) return
        const newSub: SubCategory = {
            nameEnglish: 'New Sub-Category',
            nameArabic: 'فئة فرعية جديدة',
            imageUrl: ''
        }
        const updatedSubs = [...(category.subcategories || []), newSub]
        setLocalCategory(prev => prev ? { ...prev, subcategories: updatedSubs } : null)
        await updateCategoryMutation.mutateAsync({ subcategories: updatedSubs })
        toast.success('Sub-category added and saved')
    }

    const handleDeleteSubCategory = async (index: number) => {
        if (!category || !confirm('Delete this sub-category?')) return
        const updatedSubs = (category.subcategories || []).filter((_, i) => i !== index)
        setLocalCategory(prev => prev ? { ...prev, subcategories: updatedSubs } : null)
        await updateCategoryMutation.mutateAsync({ subcategories: updatedSubs })
        toast.success('Sub-category deleted and saved')
    }

    const handleUpdateSubCategory = async (index: number, updates: Partial<SubCategory>) => {
        if (!category) return
        const updatedSubs = category.subcategories.map((sub, i) =>
            i === index ? { ...sub, ...updates } : sub
        )
        await updateCategoryMutation.mutateAsync({ subcategories: updatedSubs })
    }

    const moveSubCategory = async (index: number, direction: 'up' | 'down') => {
        if (!category) return
        const newSubs = [...(category.subcategories || [])]
        const targetIndex = direction === 'up' ? index - 1 : index + 1
        if (targetIndex < 0 || targetIndex >= newSubs.length) return

        const temp = newSubs[index]
        newSubs[index] = newSubs[targetIndex]
        newSubs[targetIndex] = temp

        setLocalCategory(prev => prev ? { ...prev, subcategories: newSubs } : null)
        await updateCategoryMutation.mutateAsync({ subcategories: newSubs })
        toast.success('Order saved')
    }

    const handleSubImageChange = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0]
        if (!file || !category) return

        setUploadingSubId(index)
        try {
            const downloadURL = await uploadImage(
                `categories/subcategories/${Date.now()}_${file.name}`,
                file,
                { maxWidth: 512, quality: 0.8 }
            )

            const updatedSubs = category.subcategories.map((sub, i) =>
                i === index ? { ...sub, imageUrl: downloadURL } : sub
            )
            await updateCategoryMutation.mutateAsync({ subcategories: updatedSubs })
            toast.success('Sub-category image updated and saved')
        } catch (error) {
            console.error('Error uploading sub image:', error)
            toast.error('Upload failed')
        } finally {
            setUploadingSubId(null)
            if (subInputRef.current) subInputRef.current.value = ''
        }
    }

    if (categoryQuery.isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        )
    }

    if (categoryQuery.isError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <p className="text-red-500 font-bold">Error loading category: {categoryQuery.error.message}</p>
                <Button onClick={() => navigate({ to: '/admin/cms/categories' })}>Back to Categories</Button>
            </div>
        )
    }

    if (!category) return null

    return (
        <div className="p-8 space-y-10 max-w-6xl mx-auto font-sans bg-white min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-xl bg-gray-100 hover:bg-gray-200"
                        onClick={() => navigate({ to: '/admin/cms/categories' })}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                            <FolderOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">{category.nameEnglish}</h1>
                            <p className="text-xs text-gray-500 font-medium">{category.subcategories?.length || 0} sub-categor{category.subcategories?.length !== 1 ? 'ies' : 'y'}</p>
                        </div>
                    </div>
                </div>
                <Button
                    onClick={handleSaveChanges}
                    disabled={updateCategoryMutation.isPending || !localCategory}
                    className="bg-green-600 hover:bg-green-700 text-white rounded-xl px-8 h-10 font-bold shadow-lg shadow-green-200 transition-all flex items-center gap-2"
                >
                    {updateCategoryMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        'Save Category Titles'
                    )}
                </Button>
            </div>

            {/* Cover Section */}
            <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="relative w-[130px] h-[175px] rounded-2xl overflow-hidden bg-gray-100 shadow-sm border border-gray-100 group">
                    <img src={category.imageUrl} className="w-full h-full object-cover" alt="Cover" />
                    <div className="absolute top-3 left-0 right-0 px-3">
                        <Badge className="w-full justify-center bg-purple-600 text-[10px] py-1 border-none shadow-sm font-bold rounded-xl">
                            {category.nameEnglish}
                        </Badge>
                    </div>
                    {uploadingCover && (
                        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                        </div>
                    )}
                </div>
                <div className="flex flex-col justify-center gap-3">
                    <h2 className="text-xl font-bold text-gray-900">Cover Image</h2>
                    <p className="text-sm text-gray-400 font-medium italic">Recommended size: 100x135 pixels</p>
                    <Button
                        variant="outline"
                        className="rounded-xl h-11 border-gray-200 bg-[#F8F9F9] text-gray-900 font-bold px-6 shadow-sm gap-2 hover:bg-gray-100 transition-all w-fit"
                        onClick={() => coverInputRef.current?.click()}
                        disabled={uploadingCover}
                    >
                        <ImageIcon className="w-4 h-4 text-purple-600" /> Change Cover
                    </Button>
                    <input type="file" ref={coverInputRef} className="hidden" onChange={handleCoverChange} accept="image/*" />
                </div>
            </div>

            {/* Titles Input */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                    <label className="text-sm font-bold text-gray-900 ml-1">Category Title (English)</label>
                    <Input
                        value={category.nameEnglish}
                        onChange={(e) => handleUpdateCategory({ nameEnglish: e.target.value })}
                        className="h-12 rounded-xl bg-[#F8F9F9] border-gray-100 font-bold px-6 focus:ring-purple-200 focus:bg-white transition-all shadow-sm"
                    />
                </div>
                <div className="space-y-3">
                    <label className="text-sm font-bold text-gray-900 ml-1 text-right block">Category Title (Arabic)</label>
                    <Input
                        value={category.nameArabic}
                        dir="rtl"
                        onChange={(e) => handleUpdateCategory({ nameArabic: e.target.value })}
                        className="h-12 rounded-xl bg-[#F8F9F9] border-gray-100 font-bold px-6 focus:ring-purple-200 focus:bg-white transition-all shadow-sm text-right"
                    />
                </div>
            </div>

            {/* Sub-Categories */}
            <div className="space-y-8 pt-6 border-t">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-gray-900">Sub-Categories</h2>
                        <span className="text-xs font-bold px-2.5 py-0.5 bg-purple-100 text-purple-600 rounded-xl">
                            {category.subcategories?.length || 0}
                        </span>
                    </div>
                    <Button
                        onClick={handleAddSubCategory}
                        className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-6 h-10 gap-2 font-bold shadow-md transition-all"
                    >
                        <PackagePlus className="w-4 h-4" /> Add Sub-Category
                    </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {category.subcategories?.map((sub, i) => (
                        <SubCategoryItem
                            key={sub.nameEnglish || i}
                            sub={sub}
                            index={i}
                            onDelete={handleDeleteSubCategory}
                            onUpdate={handleUpdateSubCategory}
                            onMove={moveSubCategory}
                            onImageClick={(idx) => {
                                setUploadingSubId(idx)
                                subInputRef.current?.click()
                            }}
                            uploadingSubId={uploadingSubId}
                            isLast={i === (category.subcategories?.length || 0) - 1}
                            isUpdating={updateCategoryMutation.isPending}
                        />
                    ))}

                    {(!category.subcategories || category.subcategories.length === 0) && (
                        <div className="col-span-full py-12 text-center text-gray-400 font-medium italic bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100">
                            No sub-categories yet. Click "Add Sub-Category" to start.
                        </div>
                    )}
                </div>
            </div>

            <input
                type="file"
                ref={subInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => uploadingSubId !== null && handleSubImageChange(e, uploadingSubId)}
            />

            <div className="h-10" />
        </div>
    )
}
