import { useEffect, useRef, useState } from 'react'
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router'
import {
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    CalendarDays,
    Image as ImageIcon,
    Loader2,
    Plus,
    Trash2,
    Upload,
} from 'lucide-react'
import {
    Timestamp,
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    setDoc,
} from 'firebase/firestore'
import { ref, deleteObject } from 'firebase/storage'
import { db, storage } from '@/firebase/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { uploadImage } from '@/lib/upload'
import { cn } from '@/lib/utils'
import type { StudentEvent } from '@/types/events'
import { logAdminRead } from '@/lib/admin-read-logging'

export const Route = createLazyFileRoute('/admin/cms/events/')({
    component: EventsManagement,
})

function createBlankEvent(): StudentEvent {
    const id = `event_${Math.random().toString(36).slice(2, 11)}`
    return {
        id,
        titleEn: '',
        titleAr: '',
        descriptionEn: '',
        descriptionAr: '',
        locationEn: '',
        locationAr: '',
        imageUrl: '',
        link: '',
        startsAt: null,
        isActive: true,
    }
}

function toDateTimeInput(value: StudentEvent['startsAt']) {
    if (!value) return ''
    let date: Date

    if (value instanceof Date) {
        date = value
    } else if (typeof value === 'string') {
        date = new Date(value)
    } else if (typeof value?.toDate === 'function') {
        date = value.toDate()
    } else {
        return ''
    }

    if (Number.isNaN(date.getTime())) return ''

    const offsetMs = date.getTimezoneOffset() * 60_000
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function normalizeEventForWrite(event: StudentEvent) {
    const now = new Date().toISOString()
    const startsAtValue = toDateTimeInput(event.startsAt)

    return {
        id: event.id,
        titleEn: event.titleEn.trim(),
        titleAr: event.titleAr?.trim() || '',
        descriptionEn: event.descriptionEn?.trim() || '',
        descriptionAr: event.descriptionAr?.trim() || '',
        locationEn: event.locationEn?.trim() || '',
        locationAr: event.locationAr?.trim() || '',
        imageUrl: event.imageUrl || '',
        link: event.link?.trim() || '',
        startsAt: startsAtValue ? Timestamp.fromDate(new Date(startsAtValue)) : null,
        isActive: event.isActive !== false,
        createdAt: event.createdAt || now,
        updatedAt: now,
    } satisfies StudentEvent
}

function EventsManagement() {
    const navigate = useNavigate()
    const [events, setEvents] = useState<StudentEvent[]>([])
    const [lastUpdated, setLastUpdated] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState<string | null>(null)
    const [activeEventId, setActiveEventId] = useState<string | null>(null)
    const [pendingDeletions, setPendingDeletions] = useState<string[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        fetchEvents()
    }, [])

    const fetchEvents = async () => {
        setLoading(true)
        try {
            const eventsQuery = query(collection(db, 'events'), orderBy('startsAt'))
            const snapshot = await getDocs(eventsQuery)
            const nextEvents = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data(),
            })) as StudentEvent[]

            logAdminRead('cms-events', {
                docsFetched: snapshot.size,
                docsDisplayed: nextEvents.length,
                note: 'expected-small-managed-list',
            })

            setEvents(nextEvents)
            setLastUpdated(nextEvents.reduce((latest, event) => event.updatedAt && event.updatedAt > latest ? event.updatedAt : latest, ''))
        } catch (error) {
            console.error('Error fetching events:', error)
            toast.error('Failed to load events')
        } finally {
            setLoading(false)
        }
    }

    const saveEvents = async (updatedEvents: StudentEvent[]) => {
        const normalized = updatedEvents.map(normalizeEventForWrite)
        const now = new Date().toISOString()

        setSaving(true)
        try {
            await Promise.all(normalized.map((event) => setDoc(doc(db, 'events', event.id), event)))
            await setDoc(doc(db, 'cms', 'events'), {
                events: normalized,
                lastUpdated: now,
            })

            if (pendingDeletions.length > 0) {
                await Promise.all(pendingDeletions.map(async (url) => {
                    try {
                        await deleteObject(ref(storage, url))
                    } catch (error) {
                        console.error('Failed to delete event image:', url, error)
                    }
                }))
                setPendingDeletions([])
            }

            setEvents(normalized)
            setLastUpdated(now)
            toast.success('Events saved successfully')
        } catch (error) {
            console.error('Error saving events:', error)
            toast.error('Failed to save events')
        } finally {
            setSaving(false)
        }
    }

    const updateEvent = (eventId: string, updates: Partial<StudentEvent>) => {
        setEvents(events.map((event) => event.id === eventId ? { ...event, ...updates } : event))
    }

    const addEvent = () => {
        setEvents((current) => [...current, createBlankEvent()])
    }

    const deleteEvent = async (event: StudentEvent) => {
        if (!confirm(`Delete ${event.titleEn || 'this event'}?`)) return

        try {
            await deleteDoc(doc(db, 'events', event.id))
            if (event.imageUrl) {
                try {
                    await deleteObject(ref(storage, event.imageUrl))
                } catch (error) {
                    console.error('Failed to delete event image:', event.imageUrl, error)
                }
            }
            const remainingEvents = events.filter((item) => item.id !== event.id)
            setEvents(remainingEvents)
            await setDoc(doc(db, 'cms', 'events'), {
                events: remainingEvents.map(normalizeEventForWrite),
                lastUpdated: new Date().toISOString(),
            })
            toast.success('Event deleted')
        } catch (error) {
            console.error('Error deleting event:', error)
            toast.error('Failed to delete event')
        }
    }

    const moveEvent = (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1
        if (targetIndex < 0 || targetIndex >= events.length) return

        const nextEvents = [...events]
        const current = nextEvents[index]
        nextEvents[index] = nextEvents[targetIndex]
        nextEvents[targetIndex] = current
        setEvents(nextEvents)
    }

    const triggerUpload = (eventId: string) => {
        setActiveEventId(eventId)
        fileInputRef.current?.click()
    }

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !activeEventId) return

        setUploading(activeEventId)
        try {
            const downloadURL = await uploadImage(
                `events/${activeEventId}/${Date.now()}_${file.name}`,
                file,
                { maxWidth: 1600, quality: 0.82 }
            )

            const currentEvent = events.find((event) => event.id === activeEventId)
            if (currentEvent?.imageUrl) {
                setPendingDeletions((current) => [...current, currentEvent.imageUrl!])
            }

            updateEvent(activeEventId, { imageUrl: downloadURL })
            toast.success('Event image uploaded')
        } catch (error) {
            console.error('Error uploading event image:', error)
            toast.error('Failed to upload image')
        } finally {
            setUploading(null)
            e.target.value = ''
        }
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
                        <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
                            <CalendarDays className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Student Events</h1>
                            <p className="text-xs text-gray-500 font-medium">{events.length} event{events.length !== 1 ? 's' : ''} configured</p>
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
                        onClick={() => saveEvents(events)}
                        disabled={saving}
                        className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-6 h-10 font-bold shadow-md shadow-purple-200 transition-all"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Save All Changes
                    </Button>
                </div>
            </div>

            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Mobile Event Feed</h2>
                    <p className="text-sm text-gray-500">Saved to events and mirrored to cms/events for mobile fallback.</p>
                </div>
                <Button
                    onClick={addEvent}
                    className="inline-flex items-center justify-center bg-[#F8F9F9] hover:bg-gray-100 text-gray-900 border border-gray-100 rounded-xl px-5 h-10 gap-2 font-bold text-sm shadow-sm transition-all"
                    variant="outline"
                >
                    <Plus className="w-4 h-4 text-purple-600" />
                    Add Event
                </Button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={onFileChange}
                />
            </div>

            <div className="grid grid-cols-1 gap-5">
                {events.map((event, index) => (
                    <div key={event.id} className="bg-[#F8F9F9] rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <div className="flex flex-col xl:flex-row gap-6">
                            <button
                                type="button"
                                onClick={() => triggerUpload(event.id)}
                                className="relative w-full xl:w-56 h-40 rounded-2xl overflow-hidden bg-white border-2 border-dashed border-gray-200 hover:border-purple-400 transition-all flex items-center justify-center group"
                            >
                                {event.imageUrl ? (
                                    <img src={event.imageUrl} alt={event.titleEn || 'Event'} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-gray-300">
                                        <ImageIcon className="w-8 h-8" />
                                        <span className="text-xs font-bold">Event Image</span>
                                    </div>
                                )}
                                {uploading === event.id && (
                                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                                    </div>
                                )}
                                <div className="absolute bottom-3 right-3 bg-white/95 rounded-full px-3 py-1.5 text-[10px] font-bold text-gray-700 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                    <Upload className="w-3 h-3" />
                                    Change
                                </div>
                            </button>

                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Title English</Label>
                                    <Input
                                        value={event.titleEn}
                                        onChange={(e) => updateEvent(event.id, { titleEn: e.target.value })}
                                        placeholder="Campus Night Market"
                                        className="bg-white border-gray-100 h-11 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2 text-right">
                                    <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Title Arabic</Label>
                                    <Input
                                        value={event.titleAr || ''}
                                        onChange={(e) => updateEvent(event.id, { titleAr: e.target.value })}
                                        placeholder="سوق الجامعة الليلي"
                                        dir="rtl"
                                        className="bg-white border-gray-100 h-11 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Description English</Label>
                                    <Textarea
                                        value={event.descriptionEn || ''}
                                        onChange={(e) => updateEvent(event.id, { descriptionEn: e.target.value })}
                                        placeholder="Brief event description"
                                        className="bg-white border-gray-100 min-h-24 rounded-xl resize-none"
                                    />
                                </div>
                                <div className="space-y-2 text-right">
                                    <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Description Arabic</Label>
                                    <Textarea
                                        value={event.descriptionAr || ''}
                                        onChange={(e) => updateEvent(event.id, { descriptionAr: e.target.value })}
                                        placeholder="وصف مختصر للفعالية"
                                        dir="rtl"
                                        className="bg-white border-gray-100 min-h-24 rounded-xl resize-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Location English</Label>
                                    <Input
                                        value={event.locationEn || ''}
                                        onChange={(e) => updateEvent(event.id, { locationEn: e.target.value })}
                                        placeholder="Education City"
                                        className="bg-white border-gray-100 h-11 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2 text-right">
                                    <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Location Arabic</Label>
                                    <Input
                                        value={event.locationAr || ''}
                                        onChange={(e) => updateEvent(event.id, { locationAr: e.target.value })}
                                        placeholder="المدينة التعليمية"
                                        dir="rtl"
                                        className="bg-white border-gray-100 h-11 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Start Date</Label>
                                    <Input
                                        type="datetime-local"
                                        value={toDateTimeInput(event.startsAt)}
                                        onChange={(e) => updateEvent(event.id, { startsAt: e.target.value ? new Date(e.target.value) : null })}
                                        className="bg-white border-gray-100 h-11 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">External Link</Label>
                                    <Input
                                        value={event.link || ''}
                                        onChange={(e) => updateEvent(event.id, { link: e.target.value })}
                                        placeholder="https://..."
                                        className="bg-white border-gray-100 h-11 rounded-xl"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 pt-5 mt-5 border-t border-gray-200/70">
                            <button
                                onClick={() => updateEvent(event.id, { isActive: !event.isActive })}
                                className="flex items-center gap-3"
                            >
                                <span className={cn(
                                    "w-11 h-6 rounded-full transition-colors relative shadow-inner",
                                    event.isActive ? "bg-sky-500" : "bg-gray-200"
                                )}>
                                    <span className={cn(
                                        "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all transform shadow-sm",
                                        event.isActive ? "left-5.5" : "left-0.5"
                                    )} />
                                </span>
                                <span className="text-xs font-bold text-gray-600">{event.isActive ? 'Active' : 'Inactive'}</span>
                            </button>

                            <div className="flex items-center gap-1.5">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => moveEvent(index, 'up')}
                                    disabled={index === 0}
                                    className="rounded-xl h-9 w-9 border-gray-100 bg-white text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                                >
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => moveEvent(index, 'down')}
                                    disabled={index === events.length - 1}
                                    className="rounded-xl h-9 w-9 border-gray-100 bg-white text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                                >
                                    <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => deleteEvent(event)}
                                    className="rounded-xl h-9 w-9 border-gray-100 text-red-400 hover:text-red-600 hover:bg-red-50"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}

                {events.length === 0 && (
                    <div className="py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-3">
                        <div className="bg-white p-4 rounded-xl shadow-sm">
                            <CalendarDays className="w-8 h-8 opacity-40 text-sky-600" />
                        </div>
                        <p className="font-bold text-lg text-gray-500">No events configured</p>
                        <p className="text-sm">Create the first event for the mobile home and events screens.</p>
                    </div>
                )}
            </div>

            <div className="h-20" />
        </div>
    )
}
