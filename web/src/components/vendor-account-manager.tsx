import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { accountManagerQueryOptions } from '@/lib/vendor-account-manager'

export function VendorAccountManager({ vendorId }: { vendorId: string }) {
    const manager = useQuery(accountManagerQueryOptions(vendorId))
    const contact = manager.data

    return <div>
        {manager.isError ? (
            <p role="alert">Account manager details could not be loaded. <Button variant="link" onClick={() => void manager.refetch()}>Retry</Button></p>
        ) : manager.isPending ? (
            <p role="status">Loading account manager…</p>
        ) : contact ? (
            <dl className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2 sm:p-6">
                <div><dt className="text-sm text-muted-foreground">Full name</dt><dd className="font-semibold wrap-anywhere">{contact.full_name}</dd></div>
                <div><dt className="text-sm text-muted-foreground">Contact number</dt><dd><a className="underline wrap-anywhere" href={`tel:${contact.phone.replace(/[^+0-9]/g, '')}`}>{contact.phone}</a></dd></div>
                <div className="sm:col-span-2"><dt className="text-sm text-muted-foreground">Email</dt><dd><a className="underline wrap-anywhere" href={`mailto:${encodeURIComponent(contact.email).replace('%40', '@')}`}>{contact.email}</a></dd></div>
            </dl>
        ) : (
            <p className="text-muted-foreground">An account manager has not been assigned yet.</p>
        )}
    </div>
}
