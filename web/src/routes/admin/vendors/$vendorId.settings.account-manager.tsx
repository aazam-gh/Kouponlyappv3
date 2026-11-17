import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { accountManagerQueryOptions } from '@/lib/vendor-account-manager'

export const Route = createFileRoute('/admin/vendors/$vendorId/settings/account-manager')({
    component: AccountManagerSettings,
})

function AccountManagerSettings() {
    const { vendorId } = Route.useParams()
    const queryClient = useQueryClient()
    const options = accountManagerQueryOptions(vendorId)
    const manager = useQuery(options)
    const save = useMutation({
        mutationFn: async (form: FormData) => {
            const full_name = String(form.get('full_name') ?? '').trim()
            const email = String(form.get('email') ?? '').trim()
            const phone = String(form.get('phone') ?? '').trim()
            if (!full_name) throw new Error('Enter the account manager’s name.')
            if (!/^\+?[\d(). -]+$/.test(phone) || !/^\d{5,15}$/.test(phone.replace(/\D/g, ''))) {
                throw new Error('Enter a contact number with 5 to 15 digits.')
            }
            const { error } = await supabase.from('kouponly_vendor_account_managers')
                .upsert({ vendor_id: vendorId, full_name, email, phone })
            if (error) throw error
            return { full_name, email, phone }
        },
        onSuccess: (contact) => {
            queryClient.setQueryData(options.queryKey, contact)
            toast.success('Account manager saved')
        },
        onError: (error) => toast.error(error.message),
    })

    return <section className="max-w-2xl space-y-4 rounded-xl border bg-card p-4 sm:p-6">
        <div>
            <h2 className="font-semibold">Account manager</h2>
            <p className="mt-1 text-sm text-muted-foreground">This contact appears on the vendor’s Contact Us page.</p>
        </div>
        {manager.isPending ? <p role="status">Loading account manager…</p> : manager.isError && !manager.data
            ? <div className="space-y-2"><p role="alert">Could not load account manager details.</p><Button variant="outline" onClick={() => void manager.refetch()}>Retry</Button></div>
            : <form key={vendorId} className="grid gap-4" onSubmit={event => {
                event.preventDefault()
                save.mutate(new FormData(event.currentTarget))
            }}>
                <div className="grid gap-2"><Label htmlFor="manager-name">Full name</Label><Input id="manager-name" name="full_name" required maxLength={120} defaultValue={manager.data?.full_name} disabled={save.isPending} /></div>
                <div className="grid gap-2"><Label htmlFor="manager-email">Email</Label><Input id="manager-email" name="email" type="email" required maxLength={254} defaultValue={manager.data?.email} disabled={save.isPending} /></div>
                <div className="grid gap-2"><Label htmlFor="manager-phone">Contact number</Label><Input id="manager-phone" name="phone" type="tel" required maxLength={40} defaultValue={manager.data?.phone} disabled={save.isPending} /></div>
                <Button type="submit" className="sm:w-fit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save account manager'}</Button>
            </form>}
    </section>
}
