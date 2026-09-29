import { useState, useRef } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
    ArrowLeft,
    Image as ImageIcon,
    Loader2,
    Save,
    Type,
    Link as LinkIcon
} from 'lucide-react'
import { db } from '@/firebase/config'
import {
    doc,
    getDoc,
    setDoc
} from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { UniversityItem } from '@/types/universities'
import { uploadImage } from '@/lib/upload'

export const Route = createFileRoute('/admin/cms/universities/add')({
    component: AddUniversityPage,
})

function AddUniversityPage() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState<'logo' | 'banner' | null>(null)

    const [university, setUniversity] = useState<UniversityItem>({
        id: `uni_${Math.random().toString(36).substr(2, 9)}`,
        nameEn: '',
        nameAr: '',
        logoUrl: '',
        bannerUrl: '',
        link: '',
        bannerStatus: true
    })

    const logoInputRef = useRef<HTMLInputElement>(null)
    const bannerInputRef = useRef<HTMLInputElement>(null)

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(type)
        try {
            const downloadURL = await uploadImage(
                `universities/${university.id}/${type}_${Date.now()}_${file.name}`,
                file,
                { maxWidth: type === 'logo' ? 512 : 1920, quality: 0.8 }
            )

            setUniversity(prev => ({
                ...prev,
                [type === 'logo' ? 'logoUrl' : 'bannerUrl']: downloadURL
            }))
            toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded`)
        } catch (error) {
            console.error('Error uploading image:', error)
            toast.error('Failed to upload image')
        } finally {
            setUploading(null)
        }
    }

    const handleSave = async () => {
        if (!university.nameEn.trim()) {
            toast.error('Please enter English name')
            return
        }
        if (!university.nameAr.trim()) {
            toast.error('Please enter Arabic name')
            return
        }
        if (!university.logoUrl) {
            toast.error('Please upload a logo')
            return
        }

        setLoading(true)
        try {
            const cmsRef = doc(db, 'cms', 'university')
            const cmsSnap = await getDoc(cmsRef)

            let universitiesList: UniversityItem[] = []
            if (cmsSnap.exists()) {
                universitiesList = cmsSnap.data().universities || []
            }

            universitiesList.push(university)

            await setDoc(cmsRef, {
                universities: universitiesList,
                lastUpdated: new Date().toISOString()
            }, { merge: true })

            toast.success('University added successfully')
            navigate({ to: '/admin/cms/universities' })
        } catch (error) {
            console.error('Error saving university:', error)
            toast.error('Failed to add university')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-8 space-y-8 max-w-4xl mx-auto font-sans bg-white min-h-screen">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full bg-gray-100 hover:bg-gray-200"
                        onClick={() => navigate({ to: '/admin/cms/universities' })}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">✨</span>
                        <h1 className="text-3xl font-bold tracking-tight">Add New University</h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={() => navigate({ to: '/admin/cms/universities' })}
                        className="rounded-xl px-6 h-11 font-bold border-gray-200 hover:bg-gray-50"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-8 h-11 font-bold shadow-lg shadow-purple-200 transition-all flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save University
                    </Button>
                </div>
            </div>

            <div className="bg-[#F8F9F9] rounded-[2.5rem] p-10 space-y-10 border border-gray-100 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Logo Section */}
                    <div className="space-y-4 flex flex-col items-center">
                        <p className="text-sm font-bold text-gray-900 uppercase tracking-wider">Logo</p>
                        <div
                            onClick={() => logoInputRef.current?.click()}
                            className="relative aspect-square w-48 rounded-[2rem] overflow-hidden bg-white border-2 border-dashed border-gray-200 cursor-pointer hover:border-purple-400 transition-all flex flex-col items-center justify-center group"
                        >
                            {university.logoUrl ? (
                                <>
                                    <img src={university.logoUrl} className="w-full h-full object-contain p-4" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="text-white text-xs font-bold px-4 py-2 bg-black/50 rounded-full">Change Logo</span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center gap-3 opacity-30">
                                    <ImageIcon className="w-6 h-6" />
                                    <span className="text-xs font-bold">Upload Logo</span>
                                </div>
                            )}
                            {uploading === 'logo' && (
                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                                </div>
                            )}
                        </div>
                        <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={(e) => onFileChange(e, 'logo')} />
                    </div>

                    {/* Banner Section */}
                    <div className="space-y-4 flex flex-col items-center">
                        <p className="text-sm font-bold text-gray-900 uppercase tracking-wider">Banner</p>
                        <div
                            onClick={() => bannerInputRef.current?.click()}
                            className="relative aspect-video w-full rounded-[2rem] overflow-hidden bg-white border-2 border-dashed border-gray-200 cursor-pointer hover:border-purple-400 transition-all flex flex-col items-center justify-center group"
                        >
                            {university.bannerUrl ? (
                                <>
                                    <img src={university.bannerUrl} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="text-white text-xs font-bold px-4 py-2 bg-black/50 rounded-full">Change Banner</span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center gap-3 opacity-30">
                                    <ImageIcon className="w-6 h-6" />
                                    <span className="text-xs font-bold">Upload Banner</span>
                                </div>
                            )}
                            {uploading === 'banner' && (
                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                                </div>
                            )}
                        </div>
                        <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={(e) => onFileChange(e, 'banner')} />
                    </div>
                </div>

                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 ml-1 flex items-center gap-1">
                                <Type className="w-3" /> Name (English)
                            </label>
                            <input
                                value={university.nameEn}
                                onChange={(e) => setUniversity(prev => ({ ...prev, nameEn: e.target.value }))}
                                placeholder="University Name"
                                className="w-full h-14 px-6 rounded-[1.25rem] bg-white border border-gray-100 font-bold text-gray-900 outline-none focus:border-purple-400 transition-all shadow-sm focus:ring-4 focus:ring-purple-50"
                            />
                        </div>
                        <div className="space-y-2 text-right">
                            <label className="text-sm font-bold text-gray-700 mr-1 flex items-center justify-end gap-1">
                                اسم الجامعة (العربية) <Type className="w-3" />
                            </label>
                            <input
                                value={university.nameAr}
                                onChange={(e) => setUniversity(prev => ({ ...prev, nameAr: e.target.value }))}
                                placeholder="اسم الجامعة"
                                dir="rtl"
                                className="w-full h-14 px-6 rounded-[1.25rem] bg-white border border-gray-100 font-bold text-gray-900 outline-none focus:border-purple-400 transition-all shadow-sm focus:ring-4 focus:ring-purple-50"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700 ml-1 flex items-center gap-1">
                            <LinkIcon className="w-3" /> University Link
                        </label>
                        <input
                            value={university.link}
                            onChange={(e) => setUniversity(prev => ({ ...prev, link: e.target.value }))}
                            placeholder="https://..."
                            className="w-full h-14 px-6 rounded-[1.25rem] bg-white border border-gray-100 font-bold text-gray-900 outline-none focus:border-purple-400 transition-all shadow-sm focus:ring-4 focus:ring-purple-50"
                        />
                    </div>

                    <div className="flex items-center gap-4 bg-white p-6 rounded-[1.5rem] border border-gray-50 w-fit">
                        <button
                            onClick={() => setUniversity(prev => ({ ...prev, bannerStatus: !prev.bannerStatus }))}
                            className={`w-14 h-7 rounded-full transition-colors relative shadow-inner ${university.bannerStatus ? "bg-purple-600" : "bg-gray-200"}`}
                        >
                            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all transform shadow-sm ${university.bannerStatus ? "left-8" : "left-1"}`} />
                        </button>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900 leading-none">Banner Active</span>
                            <span className="text-xs text-gray-400 mt-1 font-medium">Visible to users if enabled</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="h-20" />
        </div>
    )
}
