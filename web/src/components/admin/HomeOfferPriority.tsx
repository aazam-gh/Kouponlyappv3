import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Search, Save, Sparkles, TrendingUp, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

type Section = 'new-deals' | 'trending-vendors'
type Row = { id: string; name: string; logo?: string; offer?: string; priority: number | null }
type Draft = { included: boolean; priority: string }

const definitions = {
  'new-deals': { title: 'New Deals', column: 'new_deals_priority', description: 'Choose which active vendor cards appear in New Deals. The current primary offer is shown beneath each vendor; priority 1 appears first.' },
  'trending-vendors': { title: 'Trending Offers', column: 'trending_priority', description: 'Choose active vendors for the mobile app’s Trending Offers section and set their order. Priority 1 appears first; vendors need a current offer to appear as a card in the app.' },
} as const

async function loadRows(section: Section): Promise<Row[]> {
  const [vendorsResult, offersResult] = await Promise.all([
    supabase.from('couponly_vendors').select('id,name,status,logo_path,new_deals_priority,trending_priority').eq('status', 'Active'),
    supabase.from('couponly_offers').select('id,vendor_id,title,active,starts_at,ends_at,sort_order'),
  ])
  if (vendorsResult.error) throw vendorsResult.error
  if (offersResult.error) throw offersResult.error

  const now = Date.now()
  const offersByVendor = new Map<string, string>()
  for (const offer of [...(offersResult.data ?? [])].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) || a.id.localeCompare(b.id))) {
    const startsAt = offer.starts_at ? Date.parse(offer.starts_at) : Number.NEGATIVE_INFINITY
    const endsAt = offer.ends_at ? Date.parse(offer.ends_at) : Number.POSITIVE_INFINITY
    if (offer.active && startsAt <= now && endsAt > now && !offersByVendor.has(offer.vendor_id)) {
      offersByVendor.set(offer.vendor_id, offer.title)
    }
  }

  return (vendorsResult.data ?? []).map((vendor) => ({
    id: vendor.id,
    name: vendor.name || 'Unnamed vendor',
    logo: vendor.logo_path || undefined,
    offer: offersByVendor.get(vendor.id),
    priority: (section === 'new-deals' ? vendor.new_deals_priority : vendor.trending_priority) == null
      ? null
      : Number(section === 'new-deals' ? vendor.new_deals_priority : vendor.trending_priority),
  })).sort((a, b) => {
    if (a.priority == null && b.priority != null) return 1
    if (a.priority != null && b.priority == null) return -1
    return (a.priority ?? 0) - (b.priority ?? 0) || a.name.localeCompare(b.name)
  })
}

export function HomeOfferPriority({ section }: { section: Section }) {
  const queryClient = useQueryClient()
  const definition = definitions[section]
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [search, setSearch] = useState('')
  const { data: rows = [], isPending, error } = useQuery({
    queryKey: ['admin-home-offer-priority', section],
    queryFn: () => loadRows(section),
  })
  const saveAll = useMutation({
    mutationFn: async (changes: Array<{ id: string; draft: Draft }>) => {
      const updates = changes.map(({ id, draft }) => {
        const priority = draft.included ? Number(draft.priority) : null
        if (draft.included && (!Number.isInteger(priority) || priority! < 1 || priority! > 99999)) {
          throw new Error('Priority must be a whole number from 1 to 99999.')
        }
        return { id, priority }
      })
      const results = await Promise.all(updates.map(({ id, priority }) =>
        supabase.from('couponly_vendors').update({ [definition.column]: priority }).eq('id', id),
      ))
      const failedUpdate = results.find(result => result.error)?.error
      if (failedUpdate) throw failedUpdate
    },
    onSuccess: () => {
      setDrafts({})
      void queryClient.invalidateQueries({ queryKey: ['admin-home-offer-priority', section] })
      toast.success(`${definition.title} changes saved`)
    },
    onError: (mutationError) => toast.error(mutationError instanceof Error ? mutationError.message : 'Could not save priority'),
  })
  const nextPriority = Math.max(0, ...rows.map(row => {
    const draft = drafts[row.id]
    const priority = draft ? (draft.included ? Number(draft.priority) : 0) : (row.priority ?? 0)
    return Number.isFinite(priority) ? priority : 0
  })) + 1
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const filteredRows = normalizedSearch
    ? rows.filter(row => row.name.toLocaleLowerCase().includes(normalizedSearch))
    : rows
  const changes = rows.flatMap(row => {
    const original: Draft = { included: row.priority != null, priority: String(row.priority ?? nextPriority) }
    const draft = drafts[row.id] ?? original
    const changed = draft.included !== original.included || (draft.included && Number(draft.priority) !== row.priority)
    return changed ? [{ id: row.id, draft }] : []
  })
  const Icon = section === 'new-deals' ? Sparkles : TrendingUp

  return <div className="space-y-6">
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="size-5" /></div>
      <div><h1 className="text-2xl font-semibold">{definition.title}</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{definition.description} Selecting a vendor assigns the next priority automatically; you can change the number before saving.</p></div>
    </div>

    {isPending ? <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Loading active vendors…</div>
      : error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">Could not load vendors: {error.message}</div>
        : rows.length === 0 ? <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">No active vendors found.</div>
          : <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative w-full max-w-md">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label={`Search vendors in ${definition.title}`}
                  placeholder="Search vendors…"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  className="pl-9 pr-9"
                />
                {search && <button type="button" aria-label="Clear vendor search" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground">
                  <X aria-hidden="true" className="size-4" />
                </button>}
              </div>
              <Button disabled={changes.length === 0 || saveAll.isPending} onClick={() => saveAll.mutate(changes)}>
                {saveAll.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                Save All{changes.length > 0 ? ` (${changes.length})` : ''}
              </Button>
            </div>
            {filteredRows.length === 0
              ? <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">No vendors match “{search.trim()}”.</div>
              : <div className="divide-y rounded-xl border bg-card">
            {filteredRows.map(row => {
              const original: Draft = { included: row.priority != null, priority: String(row.priority ?? nextPriority) }
              const draft = drafts[row.id] ?? original
              const id = `${section}-${row.id}`
              return <div key={row.id} className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  {row.logo ? <img src={row.logo} alt="" className="size-11 rounded-lg border object-cover" /> : <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted font-semibold">{row.name.slice(0, 1).toUpperCase()}</div>}
                  <div className="min-w-0"><p className="truncate font-medium">{row.name}</p><p className="truncate text-sm text-muted-foreground">{row.offer || 'No active offer currently'}</p></div>
                </div>
                <Label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 hover:bg-muted/50">
                  <Checkbox className="size-6" id={`${id}-included`} checked={draft.included} disabled={saveAll.isPending} onCheckedChange={checked => setDrafts(current => ({ ...current, [row.id]: { ...draft, included: checked === true, priority: checked === true && !draft.included ? String(nextPriority) : draft.priority } }))} />
                  <span>Show in {definition.title}</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`${id}-priority`} className="whitespace-nowrap">Priority</Label>
                  <Input id={`${id}-priority`} type="number" min="1" max="99999" step="1" disabled={saveAll.isPending || !draft.included} value={draft.priority} onChange={event => setDrafts(current => ({ ...current, [row.id]: { ...draft, priority: event.target.value } }))} className="w-24" />
                </div>
              </div>
            })}
              </div>}
          </>}
  </div>
}
