import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { z } from 'zod'
import { adminStudentsQuery } from '@/lib/admin-students'
import { studentsSearchSchema } from './index'
import { CouponActivity } from '@/components/admin/CouponActivity'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export const Route = createFileRoute('/admin/students/$studentId/settings')({
  validateSearch: (search) => studentsSearchSchema.parse(search),
  params: { parse: params => ({ studentId: z.string().uuid().parse(params.studentId) }) },
  component: StudentProfile,
})
const date = (value: string) => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })

function StudentProfile() {
  const { studentId } = Route.useParams()
  const search = Route.useSearch()
  const query = useQuery(adminStudentsQuery('', 1, 10, studentId))
  const student = query.data?.students[0]
  return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-8">
    <div className="flex items-center justify-between gap-4"><Link to="/admin/students" search={search} className="flex items-center gap-2 text-sm"><ArrowLeft size={18} />Students & profiles</Link>
      <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh profile</Button></div>
    {query.isError ? <p role="alert" className="text-destructive">Could not load profile: {query.error.message}</p> : query.isPending ? <p>Loading profile…</p> : !student ? <p>Student not found.</p> : <>
      <div><h1 className="text-2xl font-semibold">{student.name}</h1><p className="text-muted-foreground">{student.email}</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle>Profile & eligibility</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
          <p>{student.eligible ? 'Eligible for free Rajagiri coupons' : 'Not eligible for MVP coupons'}</p>
          <p>Email: {student.emailVerifiedAt ? `Verified ${date(student.emailVerifiedAt)}` : 'Awaiting verification'}</p>
          <p>City: {student.city || 'Not provided'}</p><p>Phone: {student.phone || 'Not provided'}</p><p>Joined: {date(student.createdAt)}</p>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Monthly coupons</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
          <p><strong>{student.consumedThisMonth}</strong> consumed this month, across all rounds.</p>
          {student.couponMonth ? <><p>Current round: {student.couponMonth.roundNumber + 1}</p><p>{student.couponMonth.usedVendors} vendors used in this round.</p><p>Month ends: {date(student.couponMonth.endsAt)}</p></> : <p>{student.eligible ? 'The month is allocated when this student next opens their coupons.' : 'Verified @rajagiri.edu.in email required.'}</p>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Personal invite</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
          <p className="font-mono text-2xl font-semibold">{student.inviteCode ?? 'Not allocated'}</p>
          <p>{student.referralRefreshes} / {student.referralLimit} lifetime refreshes used.</p><p>{student.invitedFriends} friends linked to this invite.</p>
        </CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Referred friends</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Status</TableHead><TableHead>Joined (India)</TableHead></TableRow></TableHeader>
        <TableBody>{query.data?.referrals?.map(friend => <TableRow key={friend.id}><TableCell>{friend.email ?? 'Deleted account'}</TableCell><TableCell>{friend.status}{friend.reason && <p className="text-xs text-muted-foreground">{friend.reason.replaceAll('_', ' ').toLowerCase()}</p>}</TableCell><TableCell>{date(friend.createdAt)}</TableCell></TableRow>)}{!query.data?.referrals?.length && <TableRow><TableCell colSpan={3}>No referred friends yet.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
      <Card><CardHeader><CardTitle>Saved vendors & offers</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Saved item</TableHead><TableHead>Type</TableHead><TableHead>Saved (India)</TableHead></TableRow></TableHeader><TableBody>
        {query.data?.savedItems?.map(item => <TableRow key={item.id}><TableCell>{item.vendorId ? <Link to="/admin/vendors/$vendorId/settings/branding" params={{ vendorId: item.vendorId }} className="hover:underline">{item.title}</Link> : item.title}</TableCell><TableCell>{item.type}</TableCell><TableCell>{date(item.savedAt)}</TableCell></TableRow>)}
        {!query.data?.savedItems?.length && <TableRow><TableCell colSpan={3}>No saved items yet.</TableCell></TableRow>}
      </TableBody></Table></CardContent></Card>
      <CouponActivity userId={studentId} />
    </>}
  </div>
}
