import { useEffect, useMemo, useState } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { vendorChartDataQueryOptions, vendorQueryOptions, vendorStatsQueryOptions, vendorTransactionsQueryOptions, type ChartRange } from '@/queries'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, Building2, CalendarDays, CircleDollarSign, Clock3, LayoutDashboard, LogOut, ReceiptText, ShieldCheck, UserRound } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

type VendorSession = { user: User; vendorId: string }
type VendorPanelAppProps = { queryClient: QueryClient }

async function usernameEmail(username: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(username))
  const localPart = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  return `${localPart}@vendor.kouponly.invalid`
}

async function getVendorMembership(userId: string) {
  const { data, error } = await supabase
    .from('couponly_vendor_memberships')
    .select('vendor_id,role')
    .eq('user_id', userId)
    .in('role', ['owner', 'manager'])
    .order('vendor_id')
    .limit(2)
  if (error) throw error
  const memberships = data ?? []
  if (!memberships.length) throw new Error('This account is not linked to a vendor.')
  if (memberships.length > 1) throw new Error('This account is linked to more than one vendor. Ask an administrator to set its primary vendor.')
  return String(memberships[0].vendor_id)
}

export function VendorPanelApp({ queryClient }: VendorPanelAppProps) {
  const [session, setSession] = useState<VendorSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    let alive = true
    const applySession = async (user: User | null) => {
      if (!user) {
        if (!alive) return
        setSession(null)
        setLoading(false)
        return
      }
      try {
        const vendorId = await getVendorMembership(user.id)
        if (alive) { setSession({ user, vendorId }); setLoading(false) }
      } catch {
        if (alive) { setSession(null); setLoading(false) }
      }
    }
    void supabase.auth.getSession().then(({ data }) => applySession(data.session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, authSession) => {
      queryClient.clear()
      queueMicrotask(() => { void applySession(authSession?.user ?? null) })
    })
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => { alive = false; subscription.unsubscribe(); window.removeEventListener('popstate', onPopState) }
  }, [queryClient])

  const navigate = (to: string) => {
    window.history.pushState({}, '', to)
    setPath(to)
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading Vendor Panel…</div>
  if (!session) return <LoginPage onSuccess={async (user) => {
    const vendorId = await getVendorMembership(user.id)
    setSession({ user, vendorId })
    setPath('/dashboard')
    window.history.replaceState({}, '', '/dashboard')
  }} />

  const page = path.startsWith('/transactions') ? 'transactions' : path.startsWith('/profile') ? 'profile' : 'dashboard'
  return <VendorShell session={session} page={page} navigate={navigate} onLogout={async () => {
    await supabase.auth.signOut()
    queryClient.clear()
    setSession(null)
    navigate('/login')
  }}>
    {page === 'transactions' ? <TransactionsPage vendorId={session.vendorId} /> : page === 'profile' ? <ProfilePage vendorId={session.vendorId} /> : <DashboardPage vendorId={session.vendorId} />}
  </VendorShell>
}

function LoginPage({ onSuccess }: { onSuccess: (user: User) => Promise<void> }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setSubmitting(true)
    try {
      let { data, error: loginError } = await supabase.auth.signInWithPassword({ email: username, password })
      if (loginError) {
        const byUsername = await supabase.auth.signInWithPassword({ email: await usernameEmail(username), password })
        data = byUsername.data
        loginError = byUsername.error
      }
      if (loginError || !data.user) throw loginError ?? new Error('Unable to sign in.')
      try { await onSuccess(data.user) } catch (membershipError) {
        await supabase.auth.signOut()
        throw membershipError
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in. Check your username and password.')
    } finally { setSubmitting(false) }
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#f5f7f5] p-4">
    <section className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
      <div className="mb-7 flex items-center gap-3"><div className="rounded-xl bg-green-100 p-3 text-green-700"><Building2 /></div><div><p className="m-0 text-xs font-semibold uppercase tracking-[.16em] text-green-700">Vendor Panel</p><h1 className="m-0 mt-1 text-2xl font-bold">Sign in to your account</h1></div></div>
      <p className="mb-6 text-sm text-muted-foreground">View your transactions and business analytics.</p>
      <form onSubmit={submit} className="space-y-4">
        <label className="grid gap-1.5 text-sm font-medium">Username<input autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} className="h-11 rounded-lg border px-3 font-normal" /></label>
        <label className="grid gap-1.5 text-sm font-medium">Password<input autoComplete="current-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="h-11 rounded-lg border px-3 font-normal" /></label>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button className="h-11 w-full rounded-lg bg-green-600 font-semibold text-white hover:bg-green-700 disabled:opacity-60" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="mt-5 flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0" />Vendor data is available only to accounts assigned to that vendor.</p>
    </section>
  </main>
}

function VendorShell({ session, page, navigate, onLogout, children }: { session: VendorSession; page: string; navigate: (to: string) => void; onLogout: () => void; children: React.ReactNode }) {
  const links = [
    { id: 'dashboard', label: 'Overview', href: '/dashboard', Icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', href: '/transactions', Icon: ReceiptText },
    { id: 'profile', label: 'Business profile', href: '/profile', Icon: UserRound },
  ]
  const name = String(session.user.user_metadata?.full_name || session.user.user_metadata?.username || 'Vendor')
  return <div className="min-h-screen bg-[#f5f7f5] md:flex">
    <aside className="flex w-full shrink-0 flex-col border-b bg-white p-4 md:min-h-screen md:w-64 md:border-b-0 md:border-r md:p-5">
      <div className="mb-6 flex items-center gap-3"><div className="rounded-xl bg-green-100 p-2 text-green-700"><Building2 className="size-5" /></div><div><p className="m-0 text-sm font-bold">Vendor Panel</p><p className="m-0 text-xs text-muted-foreground">Business insights</p></div></div>
      <nav className="flex gap-2 md:flex-col">{links.map(({ id, label, href, Icon }) => <button key={id} onClick={() => navigate(href)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${page === id ? 'bg-green-50 font-semibold text-green-800' : 'text-muted-foreground hover:bg-gray-50'}`}><Icon className="size-4" />{label}</button>)}</nav>
      <div className="mt-auto hidden border-t pt-4 md:block"><p className="m-0 truncate text-sm font-semibold">{name}</p><p className="m-0 truncate text-xs text-muted-foreground">{String(session.user.user_metadata?.username || session.user.email || '')}</p><button className="mt-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" onClick={onLogout}><LogOut className="size-4" />Sign out</button></div>
    </aside>
    <main className="min-w-0 flex-1"><header className="flex items-center justify-between border-b bg-white px-5 py-4 md:px-8"><div><p className="m-0 text-xs text-muted-foreground">Vendor Panel</p><h1 className="m-0 text-lg font-semibold">{links.find(link => link.id === page)?.label ?? 'Overview'}</h1></div><button className="flex items-center gap-2 text-sm text-muted-foreground md:hidden" onClick={onLogout}><LogOut className="size-4" />Sign out</button></header><div className="mx-auto w-full max-w-7xl p-4 md:p-8">{children}</div></main>
  </div>
}

function DashboardPage({ vendorId }: { vendorId: string }) {
  const [range, setRange] = useState<ChartRange>('30d')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const stats = useQuery(vendorStatsQueryOptions(vendorId))
  const chart = useQuery(vendorChartDataQueryOptions(vendorId, range, from, to))
  const cards = [
    { label: 'Revenue', value: money(stats.data?.totalRevenue), Icon: CircleDollarSign },
    { label: 'Redemptions', value: count(stats.data?.totalRedemptions), Icon: ReceiptText },
    { label: 'This month', value: count(stats.data?.thisMonthRedemptions), Icon: CalendarDays },
    { label: 'Discounts given', value: money(stats.data?.totalDiscount), Icon: CircleDollarSign },
    { label: 'Unique customers', value: count(stats.data?.uniqueCustomers), Icon: UserRound },
    { label: 'Active offers', value: count(stats.data?.activeOffers), Icon: BarChart3 },
    { label: 'Pending transactions', value: count(stats.data?.pendingTransactions), Icon: Clock3 },
  ]
  if (stats.isLoading || chart.isLoading) return <Loading />
  if (stats.isError || chart.isError) return <ErrorPanel message="Analytics could not be loaded. Check your connection and try again." onRetry={() => void Promise.all([stats.refetch(), chart.refetch()])} />
  return <div className="space-y-6">
    <div><h2 className="m-0 text-2xl font-bold">Business overview</h2><p className="mb-0 mt-1 text-sm text-muted-foreground">A read-only snapshot of your vendor activity.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{cards.map(({ label, value, Icon }) => <article key={label} className="rounded-xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-sm text-muted-foreground"><span>{label}</span><Icon className="size-4" /></div><p className="mb-0 mt-3 text-2xl font-bold">{value}</p></article>)}</div>
    <section className="rounded-xl border bg-white p-5 shadow-sm md:p-6"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h3 className="m-0 text-lg font-semibold">Revenue and redemptions</h3><p className="mb-0 mt-1 text-sm text-muted-foreground">Completed transactions over time</p></div><div className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-xs text-muted-foreground">From<input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className="rounded-md border px-2 py-1.5" /></label><label className="grid gap-1 text-xs text-muted-foreground">To<input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className="rounded-md border px-2 py-1.5" /></label>{!from && !to ? <select value={range} onChange={e => setRange(e.target.value as ChartRange)} className="rounded-md border bg-white px-2 py-1.5 text-sm"><option value="7d">7 days</option><option value="30d">30 days</option><option value="90d">90 days</option></select> : <button onClick={() => { setFrom(''); setTo('') }} className="px-2 py-1.5 text-sm underline">Clear dates</button>}</div></div>
      <div className="h-72">{chart.data?.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chart.data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis yAxisId="revenue" orientation="left" tickFormatter={value => `₹${Number(value).toLocaleString('en-IN')}`} tick={{ fontSize: 11 }} /><YAxis yAxisId="redemptions" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip formatter={(value, name) => name === 'revenue' ? [money(value), 'Revenue'] : [count(value), 'Redemptions']} /><Area yAxisId="revenue" type="monotone" dataKey="revenue" name="revenue" stroke="#16a34a" fill="#bbf7d0" /><Area yAxisId="redemptions" type="monotone" dataKey="redemptions" name="redemptions" stroke="#2563eb" fill="#bfdbfe" /></AreaChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No activity in this period.</div>}</div>
    </section>
  </div>
}

function TransactionsPage({ vendorId }: { vendorId: string }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const query = useQuery(vendorTransactionsQueryOptions(vendorId, from, to, page * 100))
  if (query.isLoading) return <Loading />
  if (query.isError) return <ErrorPanel message="Transactions could not be loaded. Check your connection and try again." onRetry={() => void query.refetch()} />
  return <section className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="m-0 text-2xl font-bold">Transaction history</h2><p className="mb-0 mt-1 text-sm text-muted-foreground">All transactions for your vendor account, newest first.</p></div><div className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-xs text-muted-foreground">From<input type="date" value={from} max={to || undefined} onChange={e => { setFrom(e.target.value); setPage(0) }} className="rounded-md border bg-white px-2 py-1.5" /></label><label className="grid gap-1 text-xs text-muted-foreground">To<input type="date" value={to} min={from || undefined} onChange={e => { setTo(e.target.value); setPage(0) }} className="rounded-md border bg-white px-2 py-1.5" /></label>{(from || to) && <button onClick={() => { setFrom(''); setTo(''); setPage(0) }} className="px-2 py-1.5 text-sm underline">Clear</button>}</div></div>
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b bg-gray-50 text-muted-foreground"><tr>{['Date', 'Student', 'Offer', 'Bill amount', 'Discount', 'Amount paid', 'Status'].map(label => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y">{query.data?.map(tx => <tr key={tx.id}><td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{new Date(tx.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td><td className="px-4 py-3">{tx.studentName || 'Student'}{tx.studentPhone && <span className="block text-xs text-muted-foreground">{tx.studentPhone}</span>}</td><td className="px-4 py-3">{tx.offerTitle || '—'}</td><td className="px-4 py-3">{money(tx.totalAmount)}</td><td className="px-4 py-3">{money(tx.discountAmount)}</td><td className="px-4 py-3 font-semibold">{money(tx.finalAmount)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${tx.status === 'completed' ? 'bg-green-100 text-green-800' : tx.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>{tx.status}</span></td></tr>)}{!query.data?.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No transactions found for this period.</td></tr>}</tbody></table></div><footer className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground"><span>{page * 100 + 1}–{page * 100 + (query.data?.length ?? 0)} records</span><div className="flex gap-2"><button disabled={page === 0} onClick={() => setPage(value => value - 1)} className="rounded-md border px-3 py-1.5 disabled:opacity-40">Previous</button><button disabled={(query.data?.length ?? 0) < 100} onClick={() => setPage(value => value + 1)} className="rounded-md border px-3 py-1.5 disabled:opacity-40">Next</button></div></footer></div>
  </section>
}

function ProfilePage({ vendorId }: { vendorId: string }) {
  const query = useQuery(vendorQueryOptions(vendorId))
  const entries = useMemo(() => query.data ? [['Username', query.data.username], ['Email', query.data.email], ['Phone', query.data.phoneNumber], ['Website', query.data.website], ['Status', query.data.status], ['Business type', query.data.vendorType], ['Category', query.data.mainCategory], ['Address', query.data.address]] as const : [], [query.data])
  if (query.isLoading) return <Loading />
  if (query.isError) return <ErrorPanel message="Business profile could not be loaded." onRetry={() => void query.refetch()} />
  if (!query.data) return <p className="rounded-xl border bg-white p-6 text-sm text-muted-foreground">Business profile not found.</p>
  return <section className="space-y-5"><div><h2 className="m-0 text-2xl font-bold">Business profile</h2><p className="mb-0 mt-1 text-sm text-muted-foreground">Profile information visible to your vendor account.</p></div><div className="flex items-center gap-4 rounded-xl border bg-white p-5 shadow-sm">{query.data.profilePicture ? <img className="size-16 rounded-xl border object-cover" src={query.data.profilePicture} alt="Business logo" /> : <div className="flex size-16 items-center justify-center rounded-xl bg-green-50 text-green-700"><Building2 /></div>}<div><h3 className="m-0 text-lg font-bold">{query.data.name || 'Vendor'}</h3><p className="mb-0 mt-1 text-sm text-muted-foreground">Read-only business details</p></div></div><div className="grid gap-3 sm:grid-cols-2">{entries.map(([label, value]) => <div key={label} className="rounded-xl border bg-white p-4"><p className="m-0 text-xs text-muted-foreground">{label}</p><p className="mb-0 mt-1 break-words text-sm font-medium">{value || '—'}</p></div>)}</div></section>
}

function Loading() { return <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><Clock3 className="size-4 animate-pulse" />Loading your data…</div> }
function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) { return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{message}<button className="ml-2 underline" onClick={onRetry}>Try again</button></div> }
function money(value: unknown) { return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` }
function count(value: unknown) { return Number(value || 0).toLocaleString('en-IN') }
