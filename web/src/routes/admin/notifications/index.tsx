import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Send, Loader2, Bell, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import iconUrl from '@/assets/icon.png'
import { functions } from '@/firebase/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import type { NotificationRecord } from '@/types/notifications'
import { supabase } from '@/lib/supabase'
import { Switch } from '@/components/ui/switch'

type WelcomeSettings = { id: boolean; enabled: boolean; title: string; body: string; button_label: string; button_url: string }

export const Route = createFileRoute('/admin/notifications/')({
    component: NotificationsPage,
})

function NotificationsPage() {
    const queryClient = useQueryClient()
    const defaultNotificationImageUrl = new URL(iconUrl, window.location.origin).toString()
    const [form, setForm] = useState({
        title: '',
        body: '',
        imageUrl: defaultNotificationImageUrl,
        topic: 'all-users',
    })
    const [welcome, setWelcome] = useState<WelcomeSettings>({ id: true, enabled: true, title: 'Welcome to Kouponly', body: 'You’re using Kouponly pre-launch access. Thank you for being here. Please share Kouponly with your friends.', button_label: 'Visit Kouponly', button_url: 'https://kouponly.in' })

    const { data: notificationState, isLoading, error: historyError } = useQuery({
        queryKey: ['notifications'],
        queryFn: async () => {
            const status = httpsCallable<unknown, { campaigns: NotificationRecord[]; registeredDevices: number }>(functions, 'notificationStatus')
            return (await status({})).data
        },
        refetchInterval: 30_000,
    })
    const notifications = notificationState?.campaigns
    const welcomeQuery = useQuery({ queryKey: ['account-welcome-settings'], queryFn: async () => {
        const { data, error } = await supabase.from('kouponly_account_welcome_settings').select('*').eq('id', true).single()
        if (error) throw error
        return data as WelcomeSettings
    } })
    useEffect(() => { if (welcomeQuery.data) setWelcome(welcomeQuery.data) }, [welcomeQuery.data])
    const welcomeMutation = useMutation({ mutationFn: async () => {
        if (!welcome.title.trim() || !welcome.body.trim() || !welcome.button_label.trim() || !/^https:\/\//i.test(welcome.button_url.trim())) throw new Error('Enter the message, button label, and an HTTPS website link.')
        const { data } = await supabase.auth.getUser()
        const { error } = await supabase.from('kouponly_account_welcome_settings').upsert({ ...welcome, title: welcome.title.trim(), body: welcome.body.trim(), button_label: welcome.button_label.trim(), button_url: welcome.button_url.trim(), updated_at: new Date().toISOString(), updated_by: data.user?.id ?? null })
        if (error) throw error
    }, onSuccess: () => { toast.success('Account-created message saved'); void queryClient.invalidateQueries({ queryKey: ['account-welcome-settings'] }) }, onError: error => toast.error(error instanceof Error ? error.message : 'Could not save welcome message') })

    // Send notification mutation
    const sendMutation = useMutation({
        mutationFn: async (data: { title: string; body: string; imageUrl?: string; topic: string }) => {
            const sendNotification = httpsCallable(functions, 'sendNotification')
            const result = await sendNotification(data)
            return result.data as {
                success: boolean
                campaignId: string
                status: string
                sentCount: number
                failedCount: number
                errors: string[]
            }
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
            if (!result.success) {
                toast.error('Push failed: ' + (result.errors?.join('; ') || 'No devices accepted the notification'))
                return
            }
            toast.success(`Accepted for ${result.sentCount} device(s). Delivery confirmation is pending.`)
            if (result.failedCount) toast.warning(`${result.failedCount} device(s) failed: ${result.errors.join('; ')}`)
            setForm({ title: '', body: '', imageUrl: defaultNotificationImageUrl, topic: 'all-users' })
        },
        onError: (error) => {
            toast.error('Failed to send notification: ' + (error instanceof Error ? error.message : 'Unknown error'))
        },
    })

    const handleSend = () => {
        if (!form.title.trim() || !form.body.trim()) {
            toast.error('Title and body are required')
            return
        }
        const payload: { title: string; body: string; imageUrl?: string; topic: string } = {
            title: form.title.trim(),
            body: form.body.trim(),
            topic: form.topic,
        }
        if (form.imageUrl.trim()) {
            payload.imageUrl = form.imageUrl.trim()
        }
        sendMutation.mutate(payload)
    }

    return (
        <div className="p-8 space-y-8 w-full max-w-[1600px] mx-auto">
            <div className="flex items-center gap-3">
                <Bell className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Compose Form */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Compose Notification</CardTitle>
                        <CardDescription>
                            Send a push notification to registered student devices. Maximum 2 per Qatar day.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">{notificationState?.registeredDevices ?? '…'} registered device(s). Students must sign in and allow notifications.</p>
                        <div className="space-y-2">
                            <Label htmlFor="title">Title</Label>
                            <Input
                                id="title"
                                maxLength={100}
                                placeholder="Notification title"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                disabled={sendMutation.isPending}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="body">Body</Label>
                            <Textarea
                                id="body"
                                maxLength={500}
                                placeholder="Notification message"
                                value={form.body}
                                onChange={(e) => setForm({ ...form, body: e.target.value })}
                                rows={4}
                                disabled={sendMutation.isPending}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="imageUrl">Image URL (optional)</Label>
                            <Input
                                id="imageUrl"
                                placeholder="https://example.com/image.png"
                                value={form.imageUrl}
                                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                                disabled={sendMutation.isPending}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Target Audience</Label>
                            <Input value="All Users" disabled />
                        </div>

                        <Button
                            className="bg-primary hover:bg-primary/90 text-white gap-2"
                            onClick={handleSend}
                            disabled={sendMutation.isPending}
                        >
                            {sendMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    Send Notification
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Preview */}
                <Card>
                    <CardHeader>
                        <CardTitle>Preview</CardTitle>
                        <CardDescription>How the notification will appear</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                            <div className="flex items-start gap-3">
                                {form.imageUrl ? (
                                    <img
                                        src={form.imageUrl}
                                        alt="Preview"
                                        className="h-12 w-12 rounded-lg object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none'
                                        }}
                                    />
                                ) : (
                                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="font-semibold text-sm truncate">
                                        {form.title || 'Notification Title'}
                                    </p>
                                    <p className="text-xs text-muted-foreground line-clamp-3">
                                        {form.body || 'Notification body text will appear here'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>New account welcome</CardTitle><CardDescription>Each newly created account receives this saved message in the app notification center.</CardDescription></CardHeader>
                <CardContent>
                    {welcomeQuery.isError ? <p role="alert" className="mb-4 text-sm text-destructive">Could not load welcome settings: {welcomeQuery.error.message}</p> : null}
                    <form className="grid gap-4 md:grid-cols-2" onSubmit={e => { e.preventDefault(); welcomeMutation.mutate() }}>
                        <label className="flex items-center gap-3 text-sm font-medium md:col-span-2"><Switch checked={welcome.enabled} onCheckedChange={enabled => setWelcome(v => ({ ...v, enabled }))} />Send after account creation</label>
                        <div className="space-y-2"><Label htmlFor="welcome-title">Title</Label><Input id="welcome-title" maxLength={120} value={welcome.title} onChange={e => setWelcome(v => ({ ...v, title: e.target.value }))} /></div>
                        <div className="space-y-2"><Label htmlFor="welcome-button">Button label</Label><Input id="welcome-button" maxLength={60} value={welcome.button_label} onChange={e => setWelcome(v => ({ ...v, button_label: e.target.value }))} /></div>
                        <div className="space-y-2 md:col-span-2"><Label htmlFor="welcome-body">Message</Label><Textarea id="welcome-body" maxLength={500} rows={3} value={welcome.body} onChange={e => setWelcome(v => ({ ...v, body: e.target.value }))} /></div>
                        <div className="space-y-2"><Label htmlFor="welcome-url">Button website (HTTPS)</Label><Input id="welcome-url" type="url" placeholder="https://kouponly.in" value={welcome.button_url} onChange={e => setWelcome(v => ({ ...v, button_url: e.target.value }))} /></div>
                        <div className="flex items-end"><Button disabled={welcomeMutation.isPending || welcomeQuery.isPending}>{welcomeMutation.isPending ? 'Saving…' : 'Save welcome message'}</Button></div>
                    </form>
                </CardContent>
            </Card>

            {/* Notification History */}
            <Card>
                <CardHeader>
                    <CardTitle>Notification History</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="font-bold">Title</TableHead>
                                    <TableHead className="font-bold">Body</TableHead>
                                    <TableHead className="font-bold">Topic</TableHead>
                                    <TableHead className="font-bold">Status</TableHead>
                                    <TableHead className="font-bold">Accepted / Devices</TableHead>
                                    <TableHead className="font-bold">Confirmed / Failed</TableHead>
                                    <TableHead className="font-bold">Sent At</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                                <p className="text-muted-foreground">Loading notifications...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : historyError ? (
                                    <TableRow><TableCell colSpan={7}>Could not load delivery status: {historyError.message}</TableCell></TableRow>
                                ) : !notifications || notifications.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                            No notifications sent yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    notifications.map((notification) => (
                                        <TableRow key={notification.id}>
                                            <TableCell className="font-medium">{notification.title}</TableCell>
                                            <TableCell className="max-w-xs truncate text-muted-foreground">
                                                {notification.body}
                                            </TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                                                    {notification.data?.topic || 'all-users'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="capitalize">
                                                {notification.status || 'queued'}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {notification.sent_count ?? 0}
                                                {notification.total_registered !== undefined
                                                    ? ` / ${notification.total_registered}`
                                                    : ''}
                                            </TableCell>
                                            <TableCell>
                                                {notification.receipt_success_count ?? 0} / {(notification.failed_count ?? 0) + (notification.receipt_failure_count ?? 0)}
                                                {notification.data?.errors?.length ? <p className="text-xs text-destructive">{notification.data.errors.join('; ')}</p> : null}
                                            </TableCell>
                                            <TableCell>{notification.sent_at ? new Date(notification.sent_at).toLocaleString('en-GB', {timeZone: 'Asia/Qatar'}) : '—'}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
