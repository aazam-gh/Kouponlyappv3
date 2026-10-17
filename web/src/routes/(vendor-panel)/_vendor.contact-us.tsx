import { createFileRoute } from '@tanstack/react-router'
import { Label } from "@/components/ui/label"
import { useAuth } from '@/auth'
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
    const contactInfo = {
        fullName: "Aazam",
        phoneNumber: "+974 70450340",
        email: "aazamthakur@gmail.com"
    }

    return (
        <div className="flex flex-1 flex-col p-6 lg:p-10">
            <div className="max-w-3xl space-y-8">
                <div className="space-y-4">
                    <h1 className="text-2xl font-bold tracking-tight text-[#020817]">Contact Account Manager</h1>
                    <p className="text-[#020817] text-lg font-medium leading-relaxed max-w-2xl">
                        Please contact your Account Manager using the info below for any inquiries or assistance
                    </p>
                </div>

                <div className="space-y-8 mt-10">
                    <div className="space-y-3">
                        <Label className="text-base font-bold text-[#020817]">Full Name</Label>
                        <div className="bg-[#E5E7EB] h-14 flex items-center px-6 rounded-3xl text-[#020817] font-semibold text-lg">
                            {contactInfo.fullName}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-base font-bold text-[#020817]">Phone Number</Label>
                        <div className="bg-[#E5E7EB] h-14 flex items-center px-6 rounded-3xl text-[#020817] font-semibold text-lg">
                            {contactInfo.phoneNumber}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-base font-bold text-[#020817]">Email</Label>
                        <div className="bg-[#E5E7EB] h-14 flex items-center px-6 rounded-3xl text-[#020817] font-semibold text-lg">
                            {contactInfo.email}
                        </div>
                    </div>
                </div>
                <div className="grid gap-6 border-t pt-8 sm:grid-cols-2">
                    <VendorRequestForm vendorId={user?.uid || ''} kind="staff_visit" title="Request a staff visit" prompt="Tell us when and what kind of training or support you need." />
                    <VendorRequestForm vendorId={user?.uid || ''} kind="offer" title="Request an offer" prompt="Describe the offer you would like Kouponly to review and publish." />
                </div>
            </div>
        </div>
    )
}

function VendorRequestForm({ vendorId, kind, title, prompt }: { vendorId: string; kind: 'staff_visit' | 'offer'; title: string; prompt: string }) {
    const [details, setDetails] = useState('')
    const [sending, setSending] = useState(false)
    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!vendorId || details.trim().length < 5) { toast.error('Enter a request with at least 5 characters.'); return }
        setSending(true)
        const { error } = await supabase.from('kouponly_vendor_support_requests').insert({ vendor_id: vendorId, requester_id: vendorId, request_type: kind, details: details.trim() })
        setSending(false)
        if (error) toast.error(`Request was not sent: ${error.message}`)
        else { setDetails(''); toast.success('Request sent to the Kouponly team.') }
    }
    return <form className="space-y-3 rounded-xl border bg-white p-4" onSubmit={submit}>
        <div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{prompt}</p></div>
        <Label htmlFor={`request-${kind}`}>Request details</Label>
        <Textarea id={`request-${kind}`} maxLength={2000} rows={4} value={details} onChange={e => setDetails(e.target.value)} placeholder="Write a short request" required />
        <Button type="submit" disabled={sending || !vendorId}>{sending ? 'Sending…' : 'Send request'}</Button>
    </form>
}
