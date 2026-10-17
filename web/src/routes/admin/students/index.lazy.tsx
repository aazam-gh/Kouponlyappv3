import { StudentRequests } from '@/components/admin/StudentRequests'
import { createLazyFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { adminStudentsQuery } from '@/lib/admin-students'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'
import { toast } from 'sonner'

export const Route = createLazyFileRoute('/admin/students/')({ component: Students })

function Students() {
  const [exporting, setExporting] = useState(false)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const query = useQuery(adminStudentsQuery(search.search, search.page, search.pageSize, undefined, search.sort))
  const exportCsv = async () => {
    setExporting(true)
    try {
      const students: Record<string, any>[] = []
      let total = 0
      do {
        const { data, error } = await supabase.rpc('kouponly_admin_students', { p_search: search.search, p_offset: students.length, p_limit: 100, p_user_id: null, p_sort: search.sort })
        if (error) throw error
        const page = data as { total: number; students: Record<string, any>[] }
        total = page.total
        students.push(...page.students)
      } while (students.length < total)
      const redemptions: Record<string, any>[] = []
      let redemptionTotal = 0
      do {
        const { data, error } = await supabase.rpc('kouponly_admin_coupons', { p_vendor_id: null, p_user_id: null, p_search: '', p_offset: redemptions.length, p_limit: 100, p_from: null, p_to: null })
        if (error) throw error
        const page = data as { total: number; receipts: Record<string, any>[] }
        redemptionTotal = page.total
        redemptions.push(...page.receipts)
      } while (redemptions.length < redemptionTotal)
      const history = new Map<string, Record<string, any>[]>()
      for (const redemption of redemptions) history.set(redemption.userId, [...(history.get(redemption.userId) ?? []), redemption])
      const headers = ['Student ID','Name','Primary email','Secondary email','Phone','City','University','Campus','Date of birth','Created at','Email verified at','Invite code','Referral refreshes','Referral limit','Invited friends','Coupon redemptions this month','Lifetime redemptions','Total spend','Redemption history']
      const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"','""')}"`
      const lines = students.map(student => {
        const records = history.get(student.id) ?? []
        const spend = records.reduce((sum, item) => sum + Number(item.finalAmount ?? 0), 0)
        return [student.id,student.name,student.email,student.secondaryEmail,student.phone,student.city,student.university,student.campus,student.dateOfBirth,student.createdAt,student.emailVerifiedAt,student.inviteCode,student.referralRefreshes,student.referralLimit,student.invitedFriends,student.consumedThisMonth,records.length,spend,JSON.stringify(records)].map(quote).join(',')
      })
      const url = URL.createObjectURL(new Blob([[headers.map(quote).join(','),...lines].join('\r\n')],{type:'text/csv;charset=utf-8'}))
      const anchor = document.createElement('a'); anchor.href=url; anchor.download='kouponly-students.csv'; anchor.click(); URL.revokeObjectURL(url)
    } catch (error) { toast.error(`Student export failed: ${error instanceof Error ? error.message : 'Unknown error'}`) }
    finally { setExporting(false) }
  }
  return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-8">
    <div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">Students & profiles</h1>
      <p className="mt-1 text-sm text-muted-foreground">Email verification, monthly offer access and personal invites from the mobile app.</p></div>
      <Button variant="outline" onClick={() => void exportCsv()} disabled={exporting}>{exporting ? 'Preparing export…' : 'Export CSV'}</Button>
      <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>Refresh</Button></div>
    <div className="flex flex-wrap gap-3"><Input aria-label="Search students" placeholder="Search name, email, university, campus or invite code" maxLength={200} value={search.search} className="flex-1"
      onChange={e => void navigate({ search: { ...search, search: e.target.value, page: 1 }, replace: true })} />
      <select aria-label="Sort students" value={search.sort} onChange={e => void navigate({ search: { ...search, sort: e.target.value as typeof search.sort, page: 1 } })} className="h-10 rounded-md border bg-white px-3 text-sm"><option value="created_desc">Recently joined</option><option value="spent_desc">Highest spend</option><option value="referrals_desc">Most referral uses</option></select>
    </div>
    {query.isError ? <p role="alert" className="text-destructive">Could not load students: {query.error.message}</p> : query.isPending ? <p>Loading students…</p> : <>
      <div className="overflow-x-auto rounded-2xl border bg-card"><Table>
        <TableHeader><TableRow>{['Student', 'Email verification', 'Total spend', 'Redemptions', 'Referral uses', 'Transactions this month', 'Personal invite'].map(title => <TableHead key={title}>{title}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{query.data.students.map(student => <TableRow key={student.id}>
          <TableCell><Link to="/admin/students/$studentId/settings" params={{ studentId: student.id }} search={search} className="font-medium underline-offset-4 hover:underline">{student.name}</Link><p className="text-xs text-muted-foreground">{student.email}</p></TableCell>
          <TableCell>{student.emailVerifiedAt ? 'Verified email' : 'Awaiting email verification'}</TableCell>
          <TableCell>₹{Number(student.totalSpend).toLocaleString('en-IN')}</TableCell><TableCell>{student.redemptionCount}</TableCell><TableCell>{student.invitedFriends}</TableCell>
          <TableCell>{student.consumedThisMonth}</TableCell>
          <TableCell className="font-mono">{student.inviteCode ?? 'Not allocated'}</TableCell>
        </TableRow>)}{!query.data.students.length && <TableRow><TableCell colSpan={7} className="py-10 text-center">No students match your search.</TableCell></TableRow>}</TableBody>
      </Table></div>
      <div className="flex items-center justify-between gap-3"><Button variant="outline" disabled={search.page === 1 || query.isFetching} onClick={() => void navigate({ search: { ...search, page: search.page - 1 } })}>Previous</Button>
        <span className="text-sm text-muted-foreground">Page {search.page} · {query.data.total} students</span>
        <Button variant="outline" disabled={search.page * search.pageSize >= query.data.total || query.isFetching} onClick={() => void navigate({ search: { ...search, page: search.page + 1 } })}>Next</Button></div>
    </>}
    <StudentRequests />
  </div>
}
