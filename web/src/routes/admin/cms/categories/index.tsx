import { useState, useEffect, useRef } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import {
    ArrowLeft,
    ArrowUp,
    ArrowDown,
    Trash2,
    Loader2,
    Settings,
    PackagePlus,
    FolderOpen
} from 'lucide-react'
import { db, storage } from '@/firebase/config'
import {
    collection,
    doc,
    deleteDoc,
    addDoc,
    updateDoc
} from 'firebase/firestore'
import { ref, deleteObject } from 'firebase/storage'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Category } from '@/types/categories'
import { categoriesQueryOptions } from '@/queries'
import { uploadImage } from '@/lib/upload'

export const Route = createFileRoute('/admin/cms/categories/')({
    component: CategoriesOverview,
})

function CategoriesOverview() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [categories, setCategories] = useState<Category[]>([])
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const categoriesQuery = useQuery(categoriesQueryOptions())

    useEffect(() => {
        if (categoriesQuery.data) {
            setCategories(categoriesQuery.data)
        }
    }, [categoriesQuery.data])

    const saveSortingMutation = useMutation({
        mutationFn: async (newCategories: Category[]) => {
            const batch: Promise<void>[] = []
            newCategories.forEach((cat, index) => {
                const docRef = doc(db, 'categories', cat.id)
                batch.push(updateDoc(docRef, { order: index + 1 }) as Promise<void>)
            })
            await Promise.all(batch)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] })
            toast.success('Sorting saved')
        },
        onError: (error) => {
            console.error('Error saving sorting:', error)
            toast.error('Failed to save sorting')
        }
    })

    const addCategoryMutation = useMutation({
        mutationFn: async (file: File) => {
            setUploading(true)
            const downloadURL = await uploadImage(
                `categories/${Date.now()}_${file.name}`,
                file,
                { maxWidth: 1024, quality: 0.8 }
            )

            const newCatData = {
                nameEnglish: 'New Category',
                nameArabic: 'فئة جديدة',
                imageUrl: downloadURL,
                order: categories.length + 1,
                subcategories: []
            }

            const docRef = await addDoc(collection(db, 'categories'), newCatData)
            return { id: docRef.id, ...newCatData } as Category
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] })
            toast.success('Category added')
        },
        onError: (error) => {
            console.error('Error adding category:', error)
            toast.error('Failed to add category')
        },
        onSettled: () => {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    })

    const deleteCategoryMutation = useMutation({
        mutationFn: async ({ id, imageUrl }: { id: string, imageUrl: string }) => {
            await deleteDoc(doc(db, 'categories', id))
            try {
                const imageRef = ref(storage, imageUrl)
                await deleteObject(imageRef)
            } catch (err) {
                console.error('Failed to delete storage object:', err)
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] })
            toast.success('Category deleted')
        },
        onError: (error) => {
            console.error('Error deleting category:', error)
            toast.error('Failed to delete category')
        }
    })

    const saveSorting = () => {
        saveSortingMutation.mutate(categories)
    }

    const handleAddCategory = () => {
        fileInputRef.current?.click()
    }

    const moveCategory = (index: number, direction: 'up' | 'down') => {
        const newCats = [...categories]
        const targetIndex = direction === 'up' ? index - 1 : index + 1
        if (targetIndex < 0 || targetIndex >= newCats.length) return

        const temp = newCats[index]
        newCats[index] = newCats[targetIndex]
        newCats[targetIndex] = temp
        setCategories(newCats)
    }

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            addCategoryMutation.mutate(file)
        }
    }

    const handleDelete = (id: string, imageUrl: string) => {
        if (!confirm('Are you sure you want to delete this category? This will delete all subcategories as well.')) return
        deleteCategoryMutation.mutate({ id, imageUrl })
    }

    if (categoriesQuery.isLoading && categories.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        )
    }

    return (
        <div className="p-8 space-y-8 max-w-6xl mx-auto font-sans">
            {/* Header */}
            <div className="flex items-center justify-between">
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
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                            <FolderOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
                            <p className="text-xs text-gray-500 font-medium">{categories.length} categor{categories.length !== 1 ? 'ies' : 'y'} configured</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {categories.length > 0 && (
                        <Button
                            onClick={saveSorting}
                            disabled={saveSortingMutation.isPending}
                            variant="outline"
                            className="border-purple-200 text-purple-600 hover:bg-purple-50 rounded-xl px-6 h-10 font-bold shadow-sm"
                        >
                            {saveSortingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Save Sorting
                        </Button>
                    )}
                    <Button
                        onClick={handleAddCategory}
                        disabled={uploading}
                        className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-6 h-10 gap-2 font-bold shadow-md shadow-purple-200 transition-all"
                    >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackagePlus className="w-4 h-4" />}
                        <span className="hidden sm:inline">Add New Category</span>
                    </Button>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" onChange={onFileChange} accept="image/*" />
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map((cat, index) => (
                    <div
                        key={cat.id}
                        className="bg-[#F8F9F9] rounded-2xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-all"
                    >
                        {/* Image */}
                        <div className="relative w-full aspect-square overflow-hidden bg-gray-100">
                            <img src={cat.imageUrl} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" alt={cat.nameEnglish} />
                            <div className="absolute top-3 left-3">
                                <Badge className="bg-purple-600/90 text-white rounded-xl text-[10px] py-0.5 px-2.5 border-none shadow-sm font-bold capitalize">
                                    {cat.nameEnglish}
                                </Badge>
                            </div>
                            <div className="absolute top-3 right-3">
                                <Badge className="bg-white/90 text-gray-700 rounded-xl text-[10px] py-0.5 px-2 border-none shadow-sm font-bold">
                                    {cat.subcategories?.length || 0} sub{cat.subcategories?.length !== 1 ? 's' : ''}
                                </Badge>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-4 space-y-2">
                            <h3 className="text-base font-bold text-gray-900 truncate">{cat.nameEnglish}</h3>

                            <div className="flex gap-1.5">
                                <Link to="/admin/cms/categories/$categoryId" params={{ categoryId: cat.id }} className="flex-1">
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start gap-2 rounded-xl h-9 border-gray-100 bg-white text-gray-900 font-bold text-xs px-3 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-600 transition-all shadow-sm"
                                    >
                                        <Settings className="w-3.5 h-3.5 text-purple-600" /> Manage
                                    </Button>
                                </Link>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="rounded-xl h-9 w-9 border-gray-100 bg-white text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                                    onClick={() => moveCategory(index, 'up')}
                                    disabled={index === 0}
                                >
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="rounded-xl h-9 w-9 border-gray-100 bg-white text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                                    onClick={() => moveCategory(index, 'down')}
                                    disabled={index === categories.length - 1}
                                >
                                    <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="rounded-xl h-9 w-9 border-gray-100 text-red-400 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => handleDelete(cat.id, cat.imageUrl)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {categories.length === 0 && !categoriesQuery.isLoading && (
                <div className="py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-3">
                    <div className="bg-white p-4 rounded-xl shadow-sm">
                        <PackagePlus className="w-10 h-10 opacity-30 text-purple-600" />
                    </div>
                    <p className="font-bold text-lg text-gray-500">No categories found</p>
                    <p className="text-sm">Click 'Add New Category' to create your first one.</p>
                </div>
            )}

            <div className="h-10" />
        </div>
    )
}
