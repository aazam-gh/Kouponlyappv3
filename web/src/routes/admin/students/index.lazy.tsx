import { createLazyFileRoute, Link, useNavigate, useSearch } from '@tanstack/react-router'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Search, Upload, Plus, ChevronRight, Loader2, CheckCircle2, Copy, Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { db, functions } from '@/firebase/config'
import { collection, getCountFromServer, getDocs, query, orderBy, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { STALE_TIME } from '@/lib/constants'
import type { StudentSearch } from './index'
import { logAdminRead } from '@/lib/admin-read-logging'
import { getCursorPage, resetFirestorePaginationCursors } from '@/lib/firestore-pagination'

export const Route = createLazyFileRoute('/admin/students/')({
    component: RouteComponent,
})

interface Student {
    id: string
    firstName: string
    lastName: string
    name: string
    contact: string
    role: string
    creatorCode: string
    profilePicture?: string
    cashback: number
}

function RouteComponent() {
    const queryClient = useQueryClient()
    const navigate = useNavigate({ from: '/admin/students/' })
    const { page, pageSize, search: searchQuery } = useSearch({ from: '/admin/students/' })
    const trimmedSearch = searchQuery.trim().toLowerCase()
    const [searchInput, setSearchInput] = useState(searchQuery)
    const [open, setOpen] = useState(false)
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        gender: '',
        dob: '',
        role: 'student'
    })
    const [creatorCodeResult, setCreatorCodeResult] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        setSearchInput(searchQuery)
    }, [searchQuery])

    const { data, isLoading: isQueryLoading } = useQuery({
        queryKey: ['students', page, pageSize, trimmedSearch],
        queryFn: async () => {
            const collRef = collection(db, 'students')
            const mapStudent = (docSnap: QueryDocumentSnapshot<DocumentData>): Student => {
                const data = docSnap.data() || {}
                return {
                    id: docSnap.id,
                    firstName: data.firstName || '',
                    lastName: data.lastName || '',
                    name: (data.firstName || data.lastName)
                        ? `${data.firstName || ''} ${data.lastName || ''}`.trim()
                        : (data.name || 'Unnamed Student'),
                    contact: data.email || data.phoneNumber || 'No contact',
                    isVerified: !!data.isVerified,
                    role: data.role || 'student',
                    creatorCode: data.creatorCode || '----',
                    profilePicture: data.profilePicture || '',
                    cashback: data.cashback || 0,
                } as Student
            }

            if (trimmedSearch) {
                const snapshot = await getDocs(query(collRef, orderBy('firstName')))
                const matchedStudents = snapshot.docs
                    .map(mapStudent)
                    .filter((student) => [
                        student.firstName,
                        student.lastName,
                        student.name,
                    ].some((value) => value.toLowerCase().includes(trimmedSearch)))

                return {
                    students: matchedStudents.slice((page - 1) * pageSize, page * pageSize),
                    totalCount: matchedStudents.length,
                }
            }

            const countSnapshot = await getCountFromServer(collRef)
            const totalCount = countSnapshot.data().count

            const pageResult = await getCursorPage(
                collRef,
                [orderBy('firstName')],
                page,
                pageSize,
                'students:firstName',
            )
            const students = pageResult.docs.map(mapStudent)

            logAdminRead('students-page', {
                page,
                pageSize,
                docsFetched: pageResult.docsFetched,
                docsDisplayed: students.length,
                totalCount,
            })

            return {
                students,
                totalCount,
            }
        },
        staleTime: STALE_TIME.MEDIUM,
    })

    const studentList = data?.students || []
    const totalStudents = data?.totalCount || 0

    const addStudentMutation = useMutation({
        mutationFn: async (formData: typeof form) => {
            const createStudentUser = httpsCallable(functions, 'createStudentUser')
            const result = await createStudentUser({
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                password: formData.password,
                gender: formData.gender,
                dob: formData.dob,
                role: formData.role,
            })
            return result.data as { uid?: string; creatorCode?: string; success?: boolean }
        },
        onSuccess: (data) => {
            resetFirestorePaginationCursors('students:')
            queryClient.invalidateQueries({ queryKey: ['students'] })
            if (data?.creatorCode) {
                setCreatorCodeResult(data.creatorCode)
            } else {
                setForm({
                    firstName: '',
                    lastName: '',
                    email: '',
                    password: '',
                    gender: '',
                    dob: '',
                    role: 'student'
                })
                setOpen(false)
            }
        },
        onError: (error) => {
            console.error('Error adding student: ', error)
            alert('Failed to add student: ' + (error instanceof Error ? error.message : 'Unknown error'))
        }
    })

    const loading = isQueryLoading

    const handleAddStudent = async () => {
        if (!form.email) {
            alert('Please enter an email address')
            return
        }
        addStudentMutation.mutate(form)
    }

    const submitSearch = () => {
        navigate({
            search: (prev: StudentSearch) => ({
                ...prev,
                search: searchInput.trim().toLowerCase(),
                page: 1,
            }),
        })
    }

    const hasNextPage = page * pageSize < totalStudents
    const hasPrevPage = page > 1

    return (
        <div className="p-8 space-y-6 w-full max-w-[1600px] mx-auto">
            <h1 className="text-3xl font-bold tracking-tight text-foreground font-heading">Student Overview</h1>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 w-full sm:max-w-lg">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by student name"
                            className="pl-9 bg-muted/50 border-none h-10"
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') submitSearch()
                            }}
                        />
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        className="h-10"
                        onClick={submitSearch}
                    >
                        Search
                    </Button>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button variant="outline" className="gap-2 h-10">
                        Export <Upload className="h-4 w-4" />
                    </Button>
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-brand-green hover:bg-brand-green/90 text-white gap-2 h-10">
                                <Plus className="h-4 w-4" /> Add New Student
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[550px]">
                            <DialogHeader>
                                <DialogTitle>Add New Student</DialogTitle>
                            </DialogHeader>
                            {creatorCodeResult ? (
                                <div className="py-4 space-y-4">
                                    <div className="flex items-center gap-2 text-green-600 font-medium">
                                        <CheckCircle2 className="h-5 w-5" />
                                        <span>Creator account created successfully!</span>
                                    </div>
                                    <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                                        <p className="text-sm text-muted-foreground">Generated Creator Code:</p>
                                        <div className="flex items-center gap-3">
                                            <code className="text-2xl font-mono font-bold tracking-widest">{creatorCodeResult}</code>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 px-2"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(creatorCodeResult)
                                                    setCopied(true)
                                                    setTimeout(() => setCopied(false), 2000)
                                                }}
                                            >
                                                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                    <Button
                                        className="w-full bg-brand-green hover:bg-brand-green/90 text-white"
                                        onClick={() => {
                                            setCreatorCodeResult(null)
                                            setCopied(false)
                                            setForm({
                                                firstName: '',
                                                lastName: '',
                                                email: '',
                                                password: '',
                                                gender: '',
                                                dob: '',
                                                role: 'student'
                                            })
                                            setOpen(false)
                                        }}
                                    >
                                        Done
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <div className="grid gap-4 py-4 px-1 max-h-[60vh] overflow-y-auto">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="grid gap-2">
                                                <Label htmlFor="firstName">First Name</Label>
                                                <Input
                                                    id="firstName"
                                                    value={form.firstName}
                                                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                                                    placeholder="Student"
                                                    disabled={addStudentMutation.isPending}
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="lastName">Last Name</Label>
                                                <Input
                                                    id="lastName"
                                                    value={form.lastName}
                                                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                                                    placeholder="Doe"
                                                    disabled={addStudentMutation.isPending}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="email">Email Address *</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                value={form.email}
                                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                                placeholder="student.email@example.com"
                                                disabled={addStudentMutation.isPending}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="password">Password</Label>
                                            <Input
                                                id="password"
                                                type="text"
                                                value={form.password}
                                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                                placeholder="Auto-generated if left empty"
                                                disabled={addStudentMutation.isPending}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Leave empty to auto-generate a secure password.
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="grid gap-2">
                                                <Label htmlFor="gender">Gender</Label>
                                                <Select value={form.gender || 'Unspecified'} onValueChange={(value) => setForm({ ...form, gender: value })}>
                                                    <SelectTrigger id="gender" disabled={addStudentMutation.isPending}>
                                                        <SelectValue placeholder="Select gender" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Male">Male</SelectItem>
                                                        <SelectItem value="Female">Female</SelectItem>
                                                        <SelectItem value="Unspecified">Unspecified</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="dob">Date of Birth</Label>
                                                <Input
                                                    id="dob"
                                                    type="date"
                                                    value={form.dob}
                                                    onChange={(e) => setForm({ ...form, dob: e.target.value })}
                                                    disabled={addStudentMutation.isPending}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="role">Role</Label>
                                            <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value })}>
                                                <SelectTrigger id="role" disabled={addStudentMutation.isPending}>
                                                    <SelectValue placeholder="Select role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="student">Student</SelectItem>
                                                    <SelectItem value="creator">Creator</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {form.role === 'creator' && (
                                            <div className="rounded-lg border border-brand-green/30 bg-brand-green/5 p-3">
                                                <p className="text-sm text-muted-foreground">
                                                    A unique 4-character creator code will be automatically generated for this account upon creation.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setOpen(false)}>
                                            Cancel
                                        </Button>
                                        <Button
                                            className="bg-brand-green hover:bg-brand-green/90 text-white"
                                            onClick={handleAddStudent}
                                            disabled={addStudentMutation.isPending}
                                        >
                                            {addStudentMutation.isPending ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Adding {form.role === 'creator' ? 'Creator' : 'Student'}...
                                                </>
                                            ) : (
                                                `Add ${form.role === 'creator' ? 'Creator' : 'Student'}`
                                            )}
                                        </Button>
                                    </DialogFooter>
                                </>
                            )}
                        </DialogContent>
                    </Dialog>
                    <Select defaultValue="alphabetical">
                        <SelectTrigger className="w-[180px] h-10 bg-muted/50 border-none">
                            <SelectValue placeholder="Sort by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="alphabetical">Sort by: Alphabetical</SelectItem>
                            <SelectItem value="newest">Sort by: Newest</SelectItem>
                            <SelectItem value="oldest">Sort by: Oldest</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {searchQuery && (
                <p className="text-sm text-muted-foreground">
                    {totalStudents} result{totalStudents !== 1 ? 's' : ''} found
                </p>
            )}

            <div className="rounded-md bg-card border border-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-b border-border">
                            <TableHead className="w-12">
                                <Checkbox />
                            </TableHead>
                            <TableHead className="text-foreground font-bold text-base">Student Name</TableHead>
                            <TableHead className="text-foreground font-bold text-base">Contact Info</TableHead>
                            <TableHead className="text-foreground font-bold text-base">Role</TableHead>
                            <TableHead className="text-foreground font-bold text-base">Creator Code</TableHead>
                            <TableHead className="text-foreground font-bold text-base">Cashback</TableHead>
                            <TableHead className="text-foreground font-bold text-base text-right pr-8">Actions:</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-10">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
                                        <p className="text-muted-foreground font-medium">Loading students...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : studentList.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                    No students found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            studentList.map((student: Student) => (
                                <TableRow key={student.id} className="h-16 border-b border-border hover:bg-muted/50">
                                    <TableCell>
                                        <Checkbox />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            {student.profilePicture ? (
                                                <img src={student.profilePicture} alt={student.name} className="h-10 w-10 rounded-lg object-cover shrink-0" loading="lazy" />
                                            ) : (
                                                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                                    <span className="text-muted-foreground text-xs font-bold">{student.name.charAt(0)}</span>
                                                </div>
                                            )}
                                            <span className="font-medium text-base text-foreground">{student.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium text-foreground">{student.contact}</TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${student.role === 'creator' ? 'bg-brand-green/10 text-brand-green' : 'bg-muted text-muted-foreground'}`}>
                                            {student.role}
                                        </span>
                                    </TableCell>
                                    <TableCell className="font-mono font-medium text-foreground tracking-widest">{student.creatorCode}</TableCell>
                                    <TableCell className="font-medium text-foreground">${student.cashback.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">
                                        <Link to="/admin/students/$studentId/settings" params={{ studentId: student.id }} search={{ page: 1, pageSize: 10, search: '' }}>
                                            <Button variant="outline" size="sm" className="rounded-full h-8 px-4 gap-1 text-xs font-semibold">
                                                Manage <ChevronRight className="h-3 w-3" />
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {(hasPrevPage || hasNextPage) && (
                <div className="flex items-center justify-center gap-4 pt-4">
                    <Link
                        from="/admin/students/"
                        search={(prev: StudentSearch) => ({
                            ...prev,
                            page: Math.max(1, page - 1),
                        })}
                        disabled={!hasPrevPage}
                        className={!hasPrevPage ? 'pointer-events-none opacity-50' : ''}
                    >
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 w-auto px-4 gap-2 text-sm font-medium"
                            disabled={!hasPrevPage}
                        >
                            ‹ Previous
                        </Button>
                    </Link>

                    <div className="text-sm font-medium text-muted-foreground">
                        Page {page}
                    </div>

                    <Link
                        from="/admin/students/"
                        search={(prev: StudentSearch) => ({
                            ...prev,
                            page: page + 1,
                        })}
                        disabled={!hasNextPage}
                        className={!hasNextPage ? 'pointer-events-none opacity-50' : ''}
                    >
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 w-auto px-4 gap-2 text-sm font-medium"
                            disabled={!hasNextPage}
                        >
                            Next ›
                        </Button>
                    </Link>
                </div>
            )}
        </div>
    )
}
