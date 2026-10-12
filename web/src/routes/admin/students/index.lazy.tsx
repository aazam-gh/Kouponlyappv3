import { StudentRequests } from '@/components/admin/StudentRequests'
import { createLazyFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { adminStudentsQuery } from '@/lib/admin-students'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const Route = createLazyFileRoute('/admin/students/')({ component: Students })

function Students() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const query = useQuery(adminStudentsQuery(search.search, search.page, search.pageSize))
  return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-8">
    <div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">Students & profiles</h1>
      <p className="mt-1 text-sm text-muted-foreground">Email eligibility, monthly coupons and personal invites from the mobile app.</p></div>
      <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>Refresh</Button></div>
    <Input aria-label="Search students" placeholder="Search name, email or invite code" maxLength={200} value={search.search}
      onChange={e => void navigate({ search: { ...search, search: e.target.value, page: 1 }, replace: true })} />
    {query.isError ? <p role="alert" className="text-destructive">Could not load students: {query.error.message}</p> : query.isPending ? <p>Loading students…</p> : <>
      <div className="overflow-x-auto rounded-2xl border bg-card"><Table>
        <TableHeader><TableRow>{['Student', 'Email verification', 'MVP eligibility', 'Consumed this month', 'Referral refreshes', 'Personal invite'].map(title => <TableHead key={title}>{title}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{query.data.students.map(student => <TableRow key={student.id}>
          <TableCell><Link to="/admin/students/$studentId/settings" params={{ studentId: student.id }} search={search} className="font-medium underline-offset-4 hover:underline">{student.name}</Link><p className="text-xs text-muted-foreground">{student.email}</p></TableCell>
          <TableCell>{student.emailVerifiedAt ? 'Verified email' : 'Awaiting email verification'}</TableCell>
          <TableCell><Badge variant={student.eligible ? 'default' : 'secondary'}>{student.eligible ? 'Eligible' : 'Not eligible'}</Badge></TableCell>
          <TableCell>{student.consumedThisMonth}</TableCell><TableCell>{student.referralRefreshes} / {student.referralLimit}</TableCell>
          <TableCell className="font-mono">{student.inviteCode ?? 'Not allocated'}</TableCell>
        </TableRow>)}{!query.data.students.length && <TableRow><TableCell colSpan={6} className="py-10 text-center">No students match your search.</TableCell></TableRow>}</TableBody>
      </Table></div>
      <div className="flex items-center justify-between gap-3"><Button variant="outline" disabled={search.page === 1 || query.isFetching} onClick={() => void navigate({ search: { ...search, page: search.page - 1 } })}>Previous</Button>
        <span className="text-sm text-muted-foreground">Page {search.page} · {query.data.total} students</span>
        <Button variant="outline" disabled={search.page * search.pageSize >= query.data.total || query.isFetching} onClick={() => void navigate({ search: { ...search, page: search.page + 1 } })}>Next</Button></div>
    </>}
    <StudentRequests />
  </div>
}
