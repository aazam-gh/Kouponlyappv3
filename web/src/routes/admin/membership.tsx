import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Overview = { eligibleUsers: number; redemptionsThisMonth: number; referralRefreshes: number }
export const Route = createFileRoute('/admin/membership')({ component: Membership })

function Membership() {
  const query = useQuery({
    queryKey: ['admin-mvp-membership'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('kouponly_admin_mvp_overview')
      if (error) throw error
      return data as Overview
    }, retry: false,
  })
  return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-8">
    <div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">Coupons & referrals</h1><p className="mt-1 text-sm text-muted-foreground">Free monthly coupons and personal invite refreshes.</p></div>
      <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>Refresh</Button></div>
    {query.isPending ? <p>Loading coupon activity…</p> : query.isError ? <p role="alert" className="text-destructive">{query.error.message}</p> : <div className="grid gap-4 sm:grid-cols-3">
      {([['Verified eligible students', query.data.eligibleUsers], ['Coupons consumed this month', query.data.redemptionsThisMonth], ['Lifetime referral refreshes', query.data.referralRefreshes]] as const).map(([label, value]) =>
        <Card key={label}><CardHeader><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader><CardContent className="text-3xl font-semibold">{value}</CardContent></Card>)}
    </div>}
    <Card><CardHeader><CardTitle>MVP rules</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-relaxed">
      <p>Only verified <strong>@rajagiri.edu.in</strong> email addresses qualify. Membership is free.</p>
      <p>Each student receives one coupon per vendor per calendar month, shared across all offers and branches. The month resets at midnight on the first day in India.</p>
      <p>A verified friend using a personal invite opens a fresh coupon round for the inviter. Unused coupons do not stack, and the month’s expiry stays the same. Maximum three refreshes per student across all months.</p>
      <p>Confirmation consumes the coupon and creates a unique receipt code. Receipt history stays available after every reset.</p>
    </CardContent></Card>
    <div className="flex flex-wrap gap-3"><Button asChild><Link to="/admin/transactions" search={{ page: 1, pageSize: 25 }}>View consumed coupons</Link></Button>
      <Button variant="outline" asChild><Link to="/admin/students" search={{ page: 1, pageSize: 10, search: '' }}>View student invites & referrals</Link></Button></div>
  </div>
}
