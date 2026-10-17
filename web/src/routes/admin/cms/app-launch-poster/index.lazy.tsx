import { getCmsDocument, saveCmsDocument } from '@/lib/admin-cms'
import { useEffect, useRef, useState } from 'react'
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Image as ImageIcon, Loader2, Save, Upload } from 'lucide-react'
import { uploadImage } from '@/lib/upload'
import { fetchAllVendors } from '@/lib/vendor-directory'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { CmsClickSummary } from '@/components/admin/cms/CmsClickSummary'
import { safeWebUrl } from '@/lib/safe-web-url'

const CMS_DOC_ID = 'appLaunchPoster'
type PosterConfig = { active: boolean; imageUrl: string; destinationType: 'vendor' | 'external'; vendorId: string; externalUrl: string; lastUpdated: string }

export const Route = createLazyFileRoute('/admin/cms/app-launch-poster/')({ component: AppLaunchPosterManagement })

function AppLaunchPosterManagement() {
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [poster, setPoster] = useState<PosterConfig>({ active: false, imageUrl: '', destinationType: 'vendor', vendorId: '', externalUrl: '', lastUpdated: '' })
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    void Promise.allSettled([getCmsDocument(CMS_DOC_ID), fetchAllVendors()]).then(([posterResult, vendorsResult]) => {
      if (!active) return
      if (posterResult.status === 'fulfilled') {
        const data = posterResult.value
        if (data) {
          const destinationType = data.destinationType === 'external' ? 'external' : 'vendor'
          setPoster({ active: data.active === true, imageUrl: data.imageUrl || '', destinationType, vendorId: data.vendorId || '', externalUrl: data.externalUrl || '', lastUpdated: data.lastUpdated || '' })
        }
      } else {
        console.error('Error loading app launch poster:', posterResult.reason)
        toast.error(`Failed to load poster settings: ${posterResult.reason?.message || 'Unknown error'}`)
      }
      if (vendorsResult.status === 'fulfilled') setVendors(vendorsResult.value.map(vendor => ({ id: vendor.id, name: vendor.name || 'Unnamed Vendor' })))
      else {
        console.error('Error loading poster vendors:', vendorsResult.reason)
        toast.error(`Failed to load vendors: ${vendorsResult.reason?.message || 'Unknown error'}`)
      }
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const imageUrl = await uploadImage(`app-launch-poster/${Date.now()}_${file.name}`, file, { maxWidth: 1600, quality: 0.86 })
      setPoster(current => ({ ...current, imageUrl }))
      toast.success('Poster uploaded')
    } catch (error) {
      console.error('Error uploading app launch poster:', error)
      toast.error('Failed to upload poster')
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (poster.active) {
      if (!/^https?:\/\//i.test(poster.imageUrl)) return toast.error('Upload a poster image before activating')
      if (poster.destinationType === 'vendor' && !vendors.some(vendor => vendor.id === poster.vendorId)) return toast.error('Choose a valid vendor before activating')
      if (poster.destinationType === 'external' && !safeWebUrl(poster.externalUrl)) return toast.error('Enter a valid HTTP or HTTPS website URL before activating')
    }
    setSaving(true)
    const lastUpdated = new Date().toISOString()
    try {
      await saveCmsDocument(CMS_DOC_ID, { ...poster, externalUrl: poster.externalUrl.trim(), lastUpdated } satisfies PosterConfig)
      setPoster(current => ({ ...current, lastUpdated }))
      toast.success('App launch poster saved')
    } catch (error) {
      console.error('Error saving app launch poster:', error)
      toast.error('Failed to save poster settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return <div className="mx-auto min-h-screen max-w-5xl space-y-7 bg-white p-4 font-sans sm:p-8">
    <div className="sticky top-(--header-height) z-10 flex flex-wrap items-center justify-between gap-4 border-b bg-white py-3">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-xl bg-gray-100" onClick={() => navigate({ to: '/admin/cms' })} aria-label="Back to Home content"><ArrowLeft className="h-5 w-5" /></Button>
        <div><h1 className="text-2xl font-bold">App launch poster</h1><p className="mt-1 text-sm text-gray-500">A signed-in student sees this once per app launch from Home.</p></div>
      </div>
      <Button onClick={() => void save()} disabled={saving || uploading} className="rounded-xl bg-primary text-white hover:bg-primary/90"><Save className="mr-2 h-4 w-4" />{saving ? 'Saving…' : 'Save changes'}</Button>
    </div>

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
        <div><h2 className="font-semibold">Poster image</h2><p className="mt-1 text-sm text-muted-foreground">Use a portrait campaign image. The app fits it inside the screen without cropping.</p></div>
        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={event => void handleUpload(event)} />
        {poster.imageUrl ? <img src={poster.imageUrl} alt="App launch poster preview" className="mx-auto max-h-[70vh] max-w-full rounded-xl object-contain" /> : <div className="grid min-h-64 place-items-center rounded-xl border border-dashed bg-muted/30 text-sm text-muted-foreground"><span className="flex items-center gap-2"><ImageIcon className="h-5 w-5" />No poster uploaded</span></div>}
        <Button variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}><Upload className="mr-2 h-4 w-4" />{uploading ? 'Uploading…' : poster.imageUrl ? 'Replace poster' : 'Upload poster'}</Button>
      </section>
      <section className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="font-semibold">Display and destination</h2>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4">
          <input type="checkbox" checked={poster.active} onChange={event => setPoster(current => ({ ...current, active: event.target.checked }))} className="mt-1 size-4 accent-primary" />
          <span><span className="block font-medium">Show poster on app launch</span><span className="mt-1 block text-sm text-muted-foreground">Only shown to signed-in students, once per app launch.</span></span>
        </label>
        <label className="block space-y-2 text-sm font-medium">Destination type
          <select value={poster.destinationType} onChange={event => setPoster(current => ({ ...current, destinationType: event.target.value as PosterConfig['destinationType'] }))} className="h-10 w-full rounded-md border bg-background px-3 font-normal">
            <option value="vendor">Vendor in Kouponly</option><option value="external">External link</option>
          </select>
        </label>
        {poster.destinationType === 'vendor' ? <label className="block space-y-2 text-sm font-medium">Tap destination vendor
          <select value={poster.vendorId} onChange={event => setPoster(current => ({ ...current, vendorId: event.target.value }))} className="h-10 w-full rounded-md border bg-background px-3 font-normal" disabled={!vendors.length}>
            <option value="">Choose a vendor</option>
            {vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
          </select>
        </label> : <label className="block space-y-2 text-sm font-medium">External website URL
          <input type="url" value={poster.externalUrl} onChange={event => setPoster(current => ({ ...current, externalUrl: event.target.value }))} placeholder="https://example.com" className="h-10 w-full rounded-md border bg-background px-3 font-normal" />
          <span className="block text-xs text-muted-foreground">{safeWebUrl(poster.externalUrl) || 'Enter a complete HTTP or HTTPS website address.'}</span>
        </label>}
        {poster.destinationType === 'vendor' && !vendors.length && <p className="text-sm text-amber-700">No vendors are available in the admin vendor list yet.</p>}
        {poster.imageUrl && <CmsClickSummary documentId="appLaunchPoster" itemId="appLaunchPoster" />}
        <p className="text-xs text-muted-foreground">Last updated: {poster.lastUpdated ? new Date(poster.lastUpdated).toLocaleString() : 'Never'}</p>
      </section>
    </div>
  </div>
}
