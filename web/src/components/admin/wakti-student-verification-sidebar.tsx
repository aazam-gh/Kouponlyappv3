import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { db } from "@/firebase/config"
import { logAdminRead } from "@/lib/admin-read-logging"
import { collection, getDocs, limit, query, where } from "firebase/firestore"
import { CalendarDays } from "lucide-react"

type FirestoreRecord = Record<string, unknown>

interface SuccessfulVerificationRequest {
  id: string
  label: string
  email: string | null
  role: string | null
  timestamp: Date | null
}

const REQUEST_LIMIT = 25
const STUDENT_FILTER = true

function readString(record: FirestoreRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function readTimestamp(record: FirestoreRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (!value) continue

    if (value instanceof Date) return value

    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime())) return date
      continue
    }

    if (typeof value === "object" && "toDate" in value) {
      const maybeTimestamp = value as { toDate?: () => Date }
      if (typeof maybeTimestamp.toDate === "function") {
        const date = maybeTimestamp.toDate()
        if (!Number.isNaN(date.getTime())) return date
      }
    }
  }

  return null
}

function buildLabel(record: FirestoreRecord, id: string) {
  const directLabel =
    readString(record, ["name", "studentName", "fullName"]) ||
    readString(record, ["email", "studentEmail"])

  if (directLabel) return directLabel

  const firstName = readString(record, ["firstName"])
  const lastName = readString(record, ["lastName"])
  const combinedName = [firstName, lastName].filter((value): value is string => Boolean(value)).join(" ")

  return combinedName || id
}

function formatDate(value: Date | null) {
  if (!value) return "Date unavailable"

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value)
}

function statusBadge(value: string) {
  return (
    <Badge className="rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
      {value}
    </Badge>
  )
}

async function fetchSuccessfulVerificationRequests(): Promise<SuccessfulVerificationRequest[]> {
  const collRef = collection(db, "wakti_student_verification_requests")
  const baseConstraints = [where("isStudent", "==", STUDENT_FILTER), limit(REQUEST_LIMIT)]

  let snapshot

  try {
    snapshot = await getDocs(query(collRef, where("isStudent", "==", STUDENT_FILTER), limit(REQUEST_LIMIT)))
  } catch (error) {
    snapshot = await getDocs(query(collRef, ...baseConstraints))
    logAdminRead("wakti-student-verification-sidebar-fallback", {
      docsFetched: snapshot.size,
      docsDisplayed: snapshot.size,
      error: error instanceof Error ? error.message : "query-fallback",
    })
  }

  const requests = snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data() as FirestoreRecord

      return {
        id: docSnap.id,
        label: buildLabel(data, docSnap.id),
        email: readString(data, ["email", "studentEmail"]),
        role: readString(data, ["role", "userRole", "type"]),
        timestamp: readTimestamp(data, ["submittedAt", "createdAt", "updatedAt", "reviewedAt"]),
      } satisfies SuccessfulVerificationRequest
    })
    .sort((left, right) => {
      const leftTime = left.timestamp?.getTime() ?? 0
      const rightTime = right.timestamp?.getTime() ?? 0
      return rightTime - leftTime
    })

  logAdminRead("wakti-student-verification-sidebar", {
    docsFetched: snapshot.size,
    docsDisplayed: requests.length,
    isStudent: STUDENT_FILTER,
  })

  return requests
}

export function WaktiStudentVerificationSidebar() {
  const { data: requests = [], isLoading, isError } = useQuery({
    queryKey: ["wakti-student-verification", STUDENT_FILTER],
    queryFn: fetchSuccessfulVerificationRequests,
    staleTime: 1000 * 60,
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-green">
            Wakti feed
          </p>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground">
            Wakti verification
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Documents from <span className="font-medium text-foreground">wakti_student_verification_requests</span> with
            <span className="font-medium text-foreground"> isStudent = {String(STUDENT_FILTER)}</span>.
          </p>
        </div>
        <Badge className="w-fit rounded-full bg-brand-green/10 px-3 py-1 text-brand-green hover:bg-brand-green/10">
          {requests.length} total
        </Badge>
      </div>

      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="text-base font-bold text-foreground">Student</TableHead>
              <TableHead className="text-base font-bold text-foreground">Email</TableHead>
              <TableHead className="text-base font-bold text-foreground">isStudent</TableHead>
              <TableHead className="text-base font-bold text-foreground">Status</TableHead>
              <TableHead className="text-base font-bold text-foreground">Created At</TableHead>
              <TableHead className="pr-8 text-right text-base font-bold text-foreground">ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
                    <p className="font-medium text-muted-foreground">Loading requests...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-destructive">
                  Unable to load verification requests.
                </TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No matching requests found.
                </TableCell>
              </TableRow>
            ) : (
              requests.map((request) => (
                <TableRow key={request.id} className="h-16 border-b border-border hover:bg-muted/50">
                  <TableCell>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">{request.label}</div>
                      <div className="truncate text-xs text-muted-foreground">ID {request.id}</div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {request.email || request.role || '—'}
                  </TableCell>
                  <TableCell>
                    {statusBadge(String(STUDENT_FILTER))}
                  </TableCell>
                  <TableCell>
                    {statusBadge('success')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      {formatDate(request.timestamp)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {request.id}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
