import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

type SchoolDomain = { domain: string; active: boolean; created_at: string }
export const Route = createFileRoute('/admin/school-domains')({ component: SchoolDomains })

function SchoolDomains() {
  const [domain, setDomain] = useState('')
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['school-domains'], queryFn: async () => {
    const { data, error } = await supabase.from('kouponly_school_email_domains').select('domain,active,created_at').order('domain')
    if (error) throw error
    return data as SchoolDomain[]
  } })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['school-domains'] })
  const add = useMutation({ mutationFn: async (value: string) => {
    const { error } = await supabase.from('kouponly_school_email_domains').insert({ domain: value })
    if (error) throw error
  }, onSuccess: () => { setDomain(''); toast.success('School domain added'); void refresh() }, onError: e => toast.error(e instanceof Error ? e.message : 'Could not add domain') })
  const update = useMutation({ mutationFn: async ({ value, active }: { value: string; active: boolean }) => {
    const { error } = await supabase.from('kouponly_school_email_domains').update({ active, updated_at: new Date().toISOString() }).eq('domain', value)
    if (error) throw error
  }, onSuccess: refresh, onError: e => toast.error(e instanceof Error ? e.message : 'Could not update domain') })
  const remove = useMutation({ mutationFn: async (value: string) => {
    const { error } = await supabase.from('kouponly_school_email_domains').delete().eq('domain', value)
    if (error) throw error
  }, onSuccess: () => { toast.success('School domain removed'); void refresh() }, onError: e => toast.error(e instanceof Error ? e.message : 'Could not remove domain') })
  const domains = (query.data ?? []).filter(item => item.domain.includes(search.trim().toLowerCase()))
  return <main className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-8">
    <div><h1 className="text-2xl font-semibold">School Domains</h1><p className="mt-1 text-sm text-muted-foreground">This list is kept for reference; student signup and free-offer access currently accept any verified email.</p></div>
    <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); const normalized = domain.trim().toLowerCase(); if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(normalized)) { toast.error('Enter a valid domain, such as college.edu.in'); return } add.mutate(normalized) }}>
      <Input aria-label="School email domain" placeholder="college.edu.in" value={domain} onChange={e => setDomain(e.target.value)} className="min-w-64 flex-1" />
      <Button disabled={add.isPending}>Add domain</Button>
    </form>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{query.data?.length ?? 0} approved domains</p><Input aria-label="Search approved domains" placeholder="Search domains" value={search} onChange={e => setSearch(e.target.value)} className="sm:max-w-xs" /></div>
    {query.isError ? <p role="alert" className="text-sm text-destructive">Could not load school domains: {query.error.message}</p> : query.isPending ? <p className="text-sm text-muted-foreground">Loading domains…</p> : <div className="divide-y rounded-xl border bg-white">
      {domains.map(item => <div key={item.domain} className="flex flex-wrap items-center gap-3 p-4"><span className="min-w-0 flex-1 font-medium">@{item.domain}</span><label className="flex items-center gap-2 text-sm"><Switch checked={item.active} aria-label={`${item.active ? 'Disable' : 'Enable'} ${item.domain}`} onCheckedChange={active => update.mutate({ value: item.domain, active })} />{item.active ? 'Active' : 'Inactive'}</label><Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (window.confirm(`Remove @${item.domain}?`)) remove.mutate(item.domain) }}>Remove</Button></div>)}
      {!domains.length && <p className="p-8 text-center text-sm text-muted-foreground">No matching school domains.</p>}
    </div>}
  </main>
}
