import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { httpsCallable } from 'firebase/functions'
import { ArchiveRestore, CarFront, CheckCircle2, CirclePause, CirclePlay, Loader2, RefreshCw, ShieldCheck, TicketCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { functions } from '@/firebase/config'

export const Route = createFileRoute('/admin/pilot-campaign/')({ component: BadrgoVoucherPage })

type ProgramStatus = 'active' | 'paused' | 'ended'
type Batch = {
    id: string
    status: string
    acceptedCount?: number
    duplicateCount?: number
    failedCount?: number
    createdAt?: string | null
}
type Claim = {
    id: string
    userId: string
    userEmail?: string | null
    status: string
    periodKey: string
    claimedAt?: string | null
}
type Summary = {
    exists: boolean
    status?: ProgramStatus
    totalCodes?: number
    availableCount?: number
    assignedActiveCount?: number
    redeemedCount?: number
    totalClaims?: number
    maxImportCodes?: number
    legacyMigrationAvailable?: boolean
    batches?: Batch[]
    recentClaims?: Claim[]
    title?: string
    titleAr?: string
    description?: string
    descriptionAr?: string
    instructions?: string
    instructionsAr?: string
    destinationUrl?: string
}

const defaults = {
    title: 'Your next ride is on us',
    titleAr: 'مشوارك القادم علينا',
    description: 'Claim a Badrgo ride code when you are eligible.',
    descriptionAr: 'احصل على رمز رحلة من بدر جو عند استحقاقك.',
    instructions: 'Use your current code before requesting another code in a future week.',
    instructionsAr: 'استخدم رمزك الحالي قبل طلب رمز آخر في أسبوع لاحق.',
    destinationUrl: 'https://go.badrgo.com/invite?code=R1AA52',
}

const parseCodes = (value: string) => value
    .split(/[\s,;]+/)
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean)

const validateCodes = (codes: string[]) => ({
    duplicates: codes.length - new Set(codes).size,
    invalid: codes.filter((code) => !/^[A-Z0-9_-]{6,64}$/.test(code)).length,
})

function Metric({ label, value, helper, icon: Icon }: {
    label: string
    value: number
    helper: string
    icon: typeof TicketCheck
}) {
    return (
        <Card className="border-slate-200 shadow-none">
            <CardContent className="flex items-start justify-between p-5">
                <div>
                    <p className="text-sm text-slate-500">{label}</p>
                    <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{value.toLocaleString()}</p>
                    <p className="mt-1 text-xs text-slate-500">{helper}</p>
                </div>
                <div className="rounded-2xl bg-[#fff0f3] p-3 text-[#CF0A2C]"><Icon className="h-5 w-5" /></div>
            </CardContent>
        </Card>
    )
}

function BadrgoVoucherPage() {
    const queryClient = useQueryClient()
    const [inventoryText, setInventoryText] = useState('')
    const [redemptionText, setRedemptionText] = useState('')
    const [form, setForm] = useState(defaults)
    const [formHydrated, setFormHydrated] = useState(false)
    const summaryQuery = useQuery({
        queryKey: ['badrgo-voucher-admin'],
        queryFn: async () => (await httpsCallable(functions, 'getBadrgoVoucherAdminSummary')({})).data as Summary,
        retry: false,
        refetchInterval: 60_000,
    })
    const summary = summaryQuery.data
    const inventoryCodes = useMemo(() => parseCodes(inventoryText), [inventoryText])
    const redemptionCodes = useMemo(() => parseCodes(redemptionText), [redemptionText])
    const inventoryValidation = validateCodes(inventoryCodes)
    const redemptionValidation = validateCodes(redemptionCodes)
    const maxImport = summary?.maxImportCodes || 5000
    const refresh = async () => queryClient.invalidateQueries({ queryKey: ['badrgo-voucher-admin'] })

    useEffect(() => {
        if (!summary?.exists || formHydrated) return
        setForm({
            title: summary.title || defaults.title,
            titleAr: summary.titleAr || defaults.titleAr,
            description: summary.description || defaults.description,
            descriptionAr: summary.descriptionAr || defaults.descriptionAr,
            instructions: summary.instructions || defaults.instructions,
            instructionsAr: summary.instructionsAr || defaults.instructionsAr,
            destinationUrl: summary.destinationUrl || defaults.destinationUrl,
        })
        setFormHydrated(true)
    }, [formHydrated, summary])

    const inventoryMutation = useMutation({
        mutationFn: async () => httpsCallable(functions, 'importBadrgoVoucherCodes')({
            codes: inventoryCodes,
            importId: crypto.randomUUID(),
        }),
        onSuccess: async (result) => {
            const data = result.data as { acceptedCount: number; duplicateCount: number; failedCount: number }
            setInventoryText('')
            await refresh()
            toast.success(`${data.acceptedCount} codes added; ${data.duplicateCount} already existed; ${data.failedCount} failed`)
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : 'Inventory import failed'),
    })
    const redemptionMutation = useMutation({
        mutationFn: async () => httpsCallable(functions, 'importBadrgoVoucherRedemptions')({
            codes: redemptionCodes,
            importId: crypto.randomUUID(),
        }),
        onSuccess: async (result) => {
            const data = result.data as { matchedCount: number; alreadyRedeemedCount: number; unmatchedCount: number }
            setRedemptionText('')
            await refresh()
            toast.success(`${data.matchedCount} matched; ${data.alreadyRedeemedCount} already recorded; ${data.unmatchedCount} unmatched`)
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : 'Redemption import failed'),
    })
    const statusMutation = useMutation({
        mutationFn: async (status: ProgramStatus) => httpsCallable(functions, 'setBadrgoVoucherProgramStatus')({ status }),
        onSuccess: async (_, status) => {
            await refresh()
            toast.success(`Voucher program ${status}`)
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : 'Status update failed'),
    })
    const copyMutation = useMutation({
        mutationFn: async () => httpsCallable(functions, 'updateBadrgoVoucherProgram')(form),
        onSuccess: async () => {
            await refresh()
            toast.success('Mobile copy saved')
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : 'Unable to save copy'),
    })
    const migrationMutation = useMutation({
        mutationFn: async () => httpsCallable(functions, 'migrateBadrgoPilotToVoucherProgram')({}),
        onSuccess: async (result) => {
            const data = result.data as { migratedCodes?: number; migratedClaims?: number }
            await refresh()
            toast.success(`Migrated ${data.migratedCodes || 0} legacy codes and ${data.migratedClaims || 0} claims`)
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : 'Legacy migration failed'),
    })

    const canImport = inventoryCodes.length > 0 && inventoryCodes.length <= maxImport
        && inventoryValidation.duplicates === 0 && inventoryValidation.invalid === 0
    const canImportRedemptions = redemptionCodes.length > 0 && redemptionCodes.length <= maxImport
        && redemptionValidation.duplicates === 0 && redemptionValidation.invalid === 0

    return (
        <div className="mx-auto w-full max-w-[1500px] space-y-8 p-5 md:p-8">
            <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#CF0A2C]">
                        <CarFront className="h-4 w-4" />Badrgo × realX
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Ride voucher operations</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                        Replenish inventory at any time, reconcile used codes, and manage recurring weekly eligibility.
                        Raw codes stay behind protected callable functions.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="h-8 px-3 capitalize">
                        {summary?.status || (summaryQuery.isLoading ? 'loading' : 'not configured')}
                    </Badge>
                    <Button variant="outline" size="icon" aria-label="Refresh" onClick={() => summaryQuery.refetch()} disabled={summaryQuery.isFetching}>
                        <RefreshCw className={`h-4 w-4 ${summaryQuery.isFetching ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </header>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Metric label="Available" value={summary?.availableCount || 0} helper="Ready for assignment" icon={ArchiveRestore} />
                <Metric label="Currently assigned" value={summary?.assignedActiveCount || 0} helper="Waiting for redemption" icon={TicketCheck} />
                <Metric label="Redeemed" value={summary?.redeemedCount || 0} helper="Eligible again in a later week" icon={CheckCircle2} />
                <Metric label="Total imported" value={summary?.totalCodes || 0} helper={`${summary?.totalClaims || 0} lifetime claims`} icon={ShieldCheck} />
            </section>

            <div className="flex flex-wrap gap-2">
                {summary?.legacyMigrationAvailable && (
                    <Button variant="outline" disabled={migrationMutation.isPending} onClick={() => window.confirm('Pause the legacy pilot and migrate its codes and claims?') && migrationMutation.mutate()}>
                        {migrationMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Migrate legacy pilot
                    </Button>
                )}
                {summary?.status !== 'active' && (
                    <Button className="bg-[#CF0A2C] text-white hover:bg-[#b90927]" disabled={!summary?.availableCount || statusMutation.isPending} onClick={() => window.confirm('Activate public voucher claims?') && statusMutation.mutate('active')}>
                        <CirclePlay className="h-4 w-4" />Activate
                    </Button>
                )}
                {summary?.status === 'active' && (
                    <Button variant="outline" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate('paused')}>
                        <CirclePause className="h-4 w-4" />Pause claims
                    </Button>
                )}
                {summary?.exists && summary.status !== 'ended' && (
                    <Button variant="outline" disabled={statusMutation.isPending} onClick={() => window.confirm('End this voucher program permanently?') && statusMutation.mutate('ended')}>End permanently</Button>
                )}
            </div>

            <section className="grid gap-6 xl:grid-cols-2">
                <CodeImportCard
                    title="Add voucher inventory"
                    description="Paste any replenishment batch. Existing codes are rejected safely."
                    value={inventoryText}
                    onChange={setInventoryText}
                    codes={inventoryCodes}
                    validation={inventoryValidation}
                    maxImport={maxImport}
                    action="Add protected inventory"
                    pending={inventoryMutation.isPending}
                    disabled={!canImport}
                    onSubmit={() => inventoryMutation.mutate()}
                />
                <CodeImportCard
                    title="Import Badrgo redemptions"
                    description="Paste the used-code report. Matched users become eligible in a later week."
                    value={redemptionText}
                    onChange={setRedemptionText}
                    codes={redemptionCodes}
                    validation={redemptionValidation}
                    maxImport={maxImport}
                    action="Reconcile redemptions"
                    pending={redemptionMutation.isPending}
                    disabled={!canImportRedemptions}
                    onSubmit={() => redemptionMutation.mutate()}
                />
            </section>

            <Card className="border-slate-200 shadow-none">
                <CardHeader>
                    <CardTitle>Mobile copy</CardTitle>
                    <CardDescription>The server enforces weekly and redemption eligibility; these fields control guidance.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    <CopyField label="English title" value={form.title} onChange={(title) => setForm({ ...form, title })} />
                    <CopyField label="Arabic title" value={form.titleAr} dir="rtl" onChange={(titleAr) => setForm({ ...form, titleAr })} />
                    <CopyArea label="English description" value={form.description} onChange={(description) => setForm({ ...form, description })} />
                    <CopyArea label="Arabic description" value={form.descriptionAr} dir="rtl" onChange={(descriptionAr) => setForm({ ...form, descriptionAr })} />
                    <CopyArea label="English instructions" value={form.instructions} onChange={(instructions) => setForm({ ...form, instructions })} />
                    <CopyArea label="Arabic instructions" value={form.instructionsAr} dir="rtl" onChange={(instructionsAr) => setForm({ ...form, instructionsAr })} />
                    <div className="space-y-2 md:col-span-2">
                        <Label>Badrgo destination URL</Label>
                        <Input type="url" value={form.destinationUrl} onChange={(event) => setForm({ ...form, destinationUrl: event.target.value })} />
                    </div>
                    <div className="md:col-span-2"><Button variant="outline" disabled={copyMutation.isPending} onClick={() => copyMutation.mutate()}>Save mobile copy</Button></div>
                </CardContent>
            </Card>

            <section className="grid gap-6 xl:grid-cols-2">
                <Card className="border-slate-200 shadow-none">
                    <CardHeader><CardTitle>Recent inventory batches</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        {summary?.batches?.length ? summary.batches.map((batch) => (
                            <div key={batch.id} className="flex items-center justify-between gap-4 rounded-xl border p-3 text-sm">
                                <div><p className="font-medium">{batch.acceptedCount || 0} accepted</p><p className="text-xs text-slate-500">{batch.createdAt ? new Date(batch.createdAt).toLocaleString() : batch.id}</p></div>
                                <Badge variant="outline">{batch.status}</Badge>
                            </div>
                        )) : <p className="text-sm text-slate-500">No batches imported yet.</p>}
                    </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-none">
                    <CardHeader><CardTitle>Recent claims</CardTitle><CardDescription>Voucher codes are deliberately omitted.</CardDescription></CardHeader>
                    <CardContent className="space-y-3">
                        {summary?.recentClaims?.length ? summary.recentClaims.map((claim) => (
                            <div key={claim.id} className="flex items-center justify-between gap-4 rounded-xl border p-3 text-sm">
                                <div className="min-w-0"><p className="truncate font-medium">{claim.userEmail || claim.userId}</p><p className="text-xs text-slate-500">{claim.periodKey} · {claim.claimedAt ? new Date(claim.claimedAt).toLocaleString() : 'Pending'}</p></div>
                                <Badge variant="outline">{claim.status}</Badge>
                            </div>
                        )) : <p className="text-sm text-slate-500">No voucher claims yet.</p>}
                    </CardContent>
                </Card>
            </section>
        </div>
    )
}

function CodeImportCard({ title, description, value, onChange, codes, validation, maxImport, action, pending, disabled, onSubmit }: {
    title: string
    description: string
    value: string
    onChange: (value: string) => void
    codes: string[]
    validation: { duplicates: number; invalid: number }
    maxImport: number
    action: string
    pending: boolean
    disabled: boolean
    onSubmit: () => void
}) {
    return (
        <Card className="border-slate-200 shadow-none">
            <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">{codes.length} codes</Badge>
                    {validation.duplicates > 0 && <Badge variant="destructive">{validation.duplicates} duplicate</Badge>}
                    {validation.invalid > 0 && <Badge variant="destructive">{validation.invalid} invalid</Badge>}
                    <Badge variant="outline">max {maxImport.toLocaleString()} per batch</Badge>
                </div>
                <Textarea value={value} onChange={(event) => onChange(event.target.value)} rows={11} spellCheck={false} className="font-mono text-xs" placeholder="Paste codes—one per line" />
                <Button disabled={disabled || pending} onClick={onSubmit} className="bg-slate-950 text-white hover:bg-slate-800">
                    {pending && <Loader2 className="h-4 w-4 animate-spin" />}{action}
                </Button>
            </CardContent>
        </Card>
    )
}

function CopyField({ label, value, onChange, dir }: { label: string; value: string; onChange: (value: string) => void; dir?: 'rtl' }) {
    return <div className="space-y-2"><Label>{label}</Label><Input dir={dir} value={value} onChange={(event) => onChange(event.target.value)} /></div>
}

function CopyArea({ label, value, onChange, dir }: { label: string; value: string; onChange: (value: string) => void; dir?: 'rtl' }) {
    return <div className="space-y-2"><Label>{label}</Label><Textarea dir={dir} value={value} onChange={(event) => onChange(event.target.value)} /></div>
}
