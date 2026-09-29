import { useState, useEffect, useRef } from 'react'
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router'
import {
    ArrowLeft,
    ArrowUp,
    ArrowDown,
    Image as ImageIcon,
    Plus,
    Trash2,
    Loader2,
    Type,
    Link as LinkIcon,
    Globe
} from 'lucide-react'
import { db, storage } from '@/firebase/config'
import {
    getDoc,
    doc,
    setDoc
} from 'firebase/firestore'
import { ref, deleteObject } from 'firebase/storage'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Link } from '@tanstack/react-router'
import type { UniversityItem } from '@/types/universities'
import { uploadImage } from '@/lib/upload'

export const Route = createLazyFileRoute('/admin/cms/universities/')({
    component: UniversitiesManagement,
})

function UniversitiesManagement() {
    const navigate = useNavigate()
    const [universities, setUniversities] = useState<UniversityItem[]>([])
    const [lastUpdated, setLastUpdated] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState<{ id: string, type: 'logo' | 'banner' } | null>(null)
    const [activeUpload, setActiveUpload] = useState<{ id: string, type: 'logo' | 'banner' } | null>(null)
    const [pendingDeletions, setPendingDeletions] = useState<string[]>([])

    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const cmsRef = doc(db, 'cms', 'university')
            const cmsSnap = await getDoc(cmsRef)

            if (cmsSnap.exists()) {
                const data = cmsSnap.data()
                setUniversities(data.universities || [])
                setLastUpdated(data.lastUpdated || '')
            } else {
                setUniversities([])
                setLastUpdated('')
            }
        } catch (error) {
            console.error('Error fetching data:', error)
            toast.error('Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    const saveUniversities = async (updatedUniversities: UniversityItem[]) => {
        try {
            const cmsRef = doc(db, 'cms', 'university')
            const lastUpdated = new Date().toISOString()

            await setDoc(cmsRef, {
                universities: updatedUniversities,
                lastUpdated: lastUpdated
            })

            if (pendingDeletions.length > 0) {
                await Promise.all(pendingDeletions.map(async (url) => {
                    try {
                        const imageRef = ref(storage, url)
                        await deleteObject(imageRef)
                    } catch (err) {
                        console.error('Failed to delete storage object:', url, err)
                    }
                }))
                setPendingDeletions([])
            }

            setLastUpdated(lastUpdated)
            setUniversities(updatedUniversities)
            toast.success('Universities updated successfully')
        } catch (error) {
            console.error('Error saving universities:', error)
            toast.error('Failed to save changes')
        }
    }

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>, id: string, type: 'logo' | 'banner') => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading({ id, type })
        try {
            const downloadURL = await uploadImage(
                `universities/${id}/${type}_${Date.now()}_${file.name}`,
                file,
                { maxWidth: type === 'logo' ? 512 : 1920, quality: 0.8 }
            )

            const updatedUniversities = universities.map(u => {
                if (u.id === id) {
                    const oldUrl = type === 'logo' ? u.logoUrl : u.bannerUrl
                    if (oldUrl) {
                        setPendingDeletions(prev => [...prev, oldUrl])
                    }
                    return {
                        ...u,
                        [type === 'logo' ? 'logoUrl' : 'bannerUrl']: downloadURL
                    }
                }
                return u
            })

            setUniversities(updatedUniversities)
            toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded`)
        } catch (error) {
            console.error('Error uploading image:', error)
            toast.error('Failed to upload image')
        } finally {
            setUploading(null)
        }
    }

    const handleDeleteUniversity = async (id: string) => {
        if (!confirm('Are you sure you want to delete this university?')) return
        try {
            const universityToDelete = universities.find(u => u.id === id)
            const remainingUniversities = universities.filter(u => u.id !== id)

            if (universityToDelete) {
                const cmsRef = doc(db, 'cms', 'university')
                await setDoc(cmsRef, {
                    universities: remainingUniversities,
                    lastUpdated: new Date().toISOString()
                })

                if (universityToDelete.logoUrl) {
                    try {
                        await deleteObject(ref(storage, universityToDelete.logoUrl))
                    } catch (err) { console.error(err) }
                }
                if (universityToDelete.bannerUrl) {
                    try {
                        await deleteObject(ref(storage, universityToDelete.bannerUrl))
                    } catch (err) { console.error(err) }
                }
            }
            setUniversities(remainingUniversities)
            toast.success('University deleted')
        } catch (error) {
            console.error('Error deleting university:', error)
            toast.error('Failed to delete university')
        }
    }

    const handleUpdateUniversity = (id: string, updates: Partial<UniversityItem>) => {
        setUniversities(universities.map(u => u.id === id ? { ...u, ...updates } : u))
    }

    const triggerUpload = (id: string, type: 'logo' | 'banner') => {
        setActiveUpload({ id, type })
        fileInputRef.current?.click()
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        )
    }

    return (
        <div className="p-8 space-y-8 max-w-6xl mx-auto font-sans bg-white min-h-screen">
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
                        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                            <Globe className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Universities</h1>
                            <p className="text-xs text-gray-500 font-medium">{universities.length} universit{universities.length !== 1 ? 'ies' : 'y'} configured</p>
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
                        onClick={() => saveUniversities(universities)}
                        className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-6 h-10 font-bold shadow-lg shadow-purple-200 transition-all"
                    >
                        Save All Changes
                    </Button>
                </div>
            </div>

            {/* Section Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900">Configure Universities</h2>
                    <span className="text-xs font-bold px-2.5 py-0.5 bg-amber-100 text-amber-600 rounded-xl">
                        {universities.length}
                    </span>
                </div>
                <Link
                    to="/admin/cms/universities/add"
                    className="inline-flex items-center justify-center bg-[#F8F9F9] hover:bg-gray-100 text-gray-900 border border-gray-100 rounded-xl px-5 h-10 gap-2 font-bold text-sm shadow-sm transition-all"
                >
                    <Plus className="w-4 h-4 text-purple-600" />
                    Add New University
                </Link>

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => activeUpload && onFileChange(e, activeUpload.id, activeUpload.type)}
                />
            </div>

            {/* University Cards */}
            <div className="grid grid-cols-1 gap-6">
                {universities.map((uni, index) => (
                    <div key={uni.id} className="bg-[#F8F9F9] rounded-2xl p-6 border border-gray-100 shadow-sm relative group">
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col md:flex-row gap-6">
                                {/* Images Section */}
                                <div className="flex flex-row md:flex-col gap-4">
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Logo</p>
                                        <div
                                            onClick={() => triggerUpload(uni.id, 'logo')}
                                            className="relative w-24 h-24 rounded-xl overflow-hidden bg-white border-2 border-dashed border-gray-200 cursor-pointer hover:border-purple-400 transition-all flex items-center justify-center group/img"
                                        >
                                            {uni.logoUrl ? (
                                                <img src={uni.logoUrl} className="w-full h-full object-contain p-2" loading="lazy" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-1 opacity-30">
                                                    <ImageIcon className="w-5 h-5" />
                                                    <span className="text-[10px] font-bold">Logo</span>
                                                </div>
                                            )}
                                            {uploading?.id === uni.id && uploading?.type === 'logo' && (
                                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                <span className="text-white text-[10px] font-bold px-2 py-1 bg-black/50 rounded-xl">Change</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Banner</p>
                                        <div
                                            onClick={() => triggerUpload(uni.id, 'banner')}
                                            className="relative w-48 h-24 rounded-xl overflow-hidden bg-white border-2 border-dashed border-gray-200 cursor-pointer hover:border-purple-400 transition-all flex items-center justify-center group/img"
                                        >
                                            {uni.bannerUrl ? (
                                                <img src={uni.bannerUrl} className="w-full h-full object-cover" loading="lazy" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-1 opacity-30">
                                                    <ImageIcon className="w-5 h-5" />
                                                    <span className="text-[10px] font-bold">Banner</span>
                                                </div>
                                            )}
                                            {uploading?.id === uni.id && uploading?.type === 'banner' && (
                                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                <span className="text-white text-[10px] font-bold px-2 py-1 bg-black/50 rounded-xl">Change</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Info Section */}
                                <div className="flex-1 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1">
                                                <Type className="w-3 h-3" /> Name (EN)
                                            </label>
                                            <input
                                                value={uni.nameEn}
                                                onChange={(e) => handleUpdateUniversity(uni.id, { nameEn: e.target.value })}
                                                placeholder="University Name (English)"
                                                className="w-full h-11 px-4 rounded-xl bg-white border border-gray-100 font-bold text-sm text-gray-900 outline-none focus:border-purple-400 transition-all shadow-sm"
                                            />
                                        </div>
                                        <div className="space-y-1.5 text-right">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1 flex items-center justify-end gap-1">
                                                Name (AR) <Type className="w-3 h-3" />
                                            </label>
                                            <input
                                                value={uni.nameAr}
                                                onChange={(e) => handleUpdateUniversity(uni.id, { nameAr: e.target.value })}
                                                placeholder="اسم الجامعة باللغة العربية"
                                                dir="rtl"
                                                className="w-full h-11 px-4 rounded-xl bg-white border border-gray-100 font-bold text-sm text-gray-900 outline-none focus:border-purple-400 transition-all shadow-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center gap-1">
                                                <LinkIcon className="w-3 h-3" /> University Link
                                            </label>
                                            <input
                                                value={uni.link}
                                                onChange={(e) => handleUpdateUniversity(uni.id, { link: e.target.value })}
                                                placeholder="https://..."
                                                className="w-full h-11 px-4 rounded-xl bg-white border border-gray-100 font-bold text-sm text-gray-900 outline-none focus:border-purple-400 transition-all shadow-sm"
                                            />
                                        </div>
                                        <div className="flex items-end pb-1 gap-6">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => handleUpdateUniversity(uni.id, { bannerStatus: !uni.bannerStatus })}
                                                    className={cn(
                                                        "w-11 h-6 rounded-full transition-colors relative shadow-inner",
                                                        uni.bannerStatus ? "bg-purple-600" : "bg-gray-200"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all transform shadow-sm",
                                                        uni.bannerStatus ? "left-5.5" : "left-0.5"
                                                    )} />
                                                </button>
                                                <span className="text-xs font-bold text-gray-600">
                                                    Banner {uni.bannerStatus ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-gray-200/60">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => {
                                        const updated = [...universities]
                                        if (index > 0) {
                                            const temp = updated[index]
                                            updated[index] = updated[index - 1]
                                            updated[index - 1] = temp
                                            setUniversities(updated)
                                        }
                                    }}
                                    disabled={index === 0}
                                    className="rounded-xl h-9 w-9 border-gray-100 bg-white text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                                >
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => {
                                        const updated = [...universities]
                                        if (index < universities.length - 1) {
                                            const temp = updated[index]
                                            updated[index] = updated[index + 1]
                                            updated[index + 1] = temp
                                            setUniversities(updated)
                                        }
                                    }}
                                    disabled={index === universities.length - 1}
                                    className="rounded-xl h-9 w-9 border-gray-100 bg-white text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                                >
                                    <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleDeleteUniversity(uni.id)}
                                    className="rounded-xl h-9 w-9 border-gray-100 text-red-400 hover:text-red-600 hover:bg-red-50"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}

                {universities.length === 0 && (
                    <div className="py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-3">
                        <div className="bg-white p-4 rounded-xl shadow-sm">
                            <Globe className="w-8 h-8 opacity-30 text-purple-600" />
                        </div>
                        <p className="font-bold text-lg text-gray-500">No universities configured</p>
                        <p className="text-sm">Click 'Add New University' to start the list.</p>
                    </div>
                )}
            </div>

            <div className="h-20" />
        </div>
    )
}
