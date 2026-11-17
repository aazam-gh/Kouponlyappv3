import { createFileRoute } from '@tanstack/react-router'
import { Label } from "@/components/ui/label"
import { useAuth } from '@/auth'
import { useQuery } from '@tanstack/react-query'
import { vendorMembershipQueryOptions } from '@/queries'
import { VendorAccountManager } from '@/components/vendor-account-manager'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'
import { toast } from 'sonner'

export const Route = createFileRoute('/(vendor-panel)/_vendor/contact-us')({
    component: ContactUsPage,
})

function ContactUsPage() {
    const { user } = useAuth()
    const membership = useQuery({ ...vendorMembershipQueryOptions(user?.id || ''), enabled: Boolean(user?.id) })
    const vendorId = membership.data || ''

    return (
        <div className="flex flex-1 flex-col p-6 lg:p-10">
            <div className="max-w-3xl space-y-8">
                <div className="space-y-4">
                    <h1 className="text-2xl font-bold tracking-tight text-[#020817]">Contact Account Manager</h1>
                    <p className="text-[#020817] text-lg font-medium leading-relaxed max-w-2xl">
                        Please contact your Account Manager using the info below for any inquiries or assistance
                    </p>
                </div>

                {membership.isError ? <p role="alert">{membership.error.message} <Button variant="link" onClick={() => void membership.refetch()}>Retry</Button></p>
                    : <VendorAccountManager vendorId={vendorId} />}
                <div className="grid gap-6 border-t pt-8 sm:grid-cols-2">
                    <VendorRequestForm vendorId={vendorId} requesterId={user?.id || ''} kind="staff_visit" title="Request a staff visit" prompt="Tell us when and what kind of training or support you need." />
                    <VendorRequestForm vendorId={vendorId} requesterId={user?.id || ''} kind="offer" title="Request an offer" prompt="Describe the offer you would like Kouponly to review and publish." />
                </div>
            </div>
        </div>
    )
}

function VendorRequestForm({ vendorId, requesterId, kind, title, prompt }: { vendorId: string; requesterId: string; kind: 'staff_visit' | 'offer'; title: string; prompt: string }) {
    const [details, setDetails] = useState('')
    const [sending, setSending] = useState(false)
    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!vendorId || !requesterId || details.trim().length < 5) { toast.error('Enter a request with at least 5 characters.'); return }
        setSending(true)
        const { error } = await supabase.from('kouponly_vendor_support_requests').insert({ vendor_id: vendorId, requester_id: requesterId, request_type: kind, details: details.trim() })
        setSending(false)
        if (error) toast.error(`Request was not sent: ${error.message}`)
        else { setDetails(''); toast.success('Request sent to the Kouponly team.') }
    }
    return <form className="space-y-3 rounded-xl border bg-white p-4" onSubmit={submit}>
        <div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{prompt}</p></div>
        <Label htmlFor={`request-${kind}`}>Request details</Label>
        <Textarea id={`request-${kind}`} maxLength={2000} rows={4} value={details} onChange={e => setDetails(e.target.value)} placeholder="Write a short request" required />
        <Button type="submit" disabled={sending || !vendorId || !requesterId}>{sending ? 'Sending…' : 'Send request'}</Button>
    </form>
}
