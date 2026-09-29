import { createFileRoute, Link, Outlet, redirect, useLocation } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { vendorQueryOptions, type Vendor } from '@/queries'

export type { Vendor }

export const Route = createFileRoute('/admin/vendors/$vendorId/settings')({
    component: VendorSettingsLayout,
    loader: async ({ context: { queryClient }, params: { vendorId } }) => {
        const vendor = await queryClient.ensureQueryData(vendorQueryOptions(vendorId))
        if (vendor.vendorType === 'online') {
            throw redirect({ to: '/admin/online-vendors/$vendorId/settings', params: { vendorId } })
        }
    },
})

function VendorSettingsLayout() {
    const { vendorId } = Route.useParams()
    const location = useLocation()

    const { data: vendor } = useQuery(vendorQueryOptions(vendorId))

    return (
        <div className="p-8 space-y-6 w-full max-w-[1200px] mx-auto">
            <div className="flex items-center gap-4">
                <Link
                    to="/admin/vendors"
                    search={{ page: 1, pageSize: 10, search: '', sort: 'name-asc', xcard: 'all' }}
                    className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <span className="text-slate-400 font-medium">{vendor?.name || 'Vendor'}</span>
                    </h1>
                </div>
            </div>

            <div className="w-full border-b">
                <div className="flex w-full max-w-xl bg-muted/50 p-1 rounded-lg gap-1">
                    <Link
                        to="/admin/vendors/$vendorId/settings/branding"
                        params={{ vendorId }}
                        className={`flex-1 flex items-center justify-center h-10 rounded-md text-sm font-medium transition-all ${location.pathname.endsWith('branding')
                            ? 'bg-white text-black shadow-sm'
                            : 'text-muted-foreground hover:text-black hover:bg-white/50'
                            }`}
                    >
                        Branding
                    </Link>
                    <Link
                        to="/admin/vendors/$vendorId/settings/offers"
                        params={{ vendorId }}
                        className={`flex-1 flex items-center justify-center h-10 rounded-md text-sm font-medium transition-all ${location.pathname.endsWith('offers')
                            ? 'bg-white text-black shadow-sm'
                            : 'text-muted-foreground hover:text-black hover:bg-white/50'
                            }`}
                    >
                        Offers
                    </Link>
                    <Link
                        to="/admin/vendors/$vendorId/settings/location"
                        params={{ vendorId }}
                        className={`flex-1 flex items-center justify-center h-10 rounded-md text-sm font-medium transition-all ${location.pathname.endsWith('location')
                            ? 'bg-white text-black shadow-sm'
                            : 'text-muted-foreground hover:text-black hover:bg-white/50'
                            }`}
                    >
                        Location
                    </Link>
                    <Link
                        to="/admin/vendors/$vendorId/settings/invoices"
                        params={{ vendorId }}
                        className={`flex-1 flex items-center justify-center h-10 rounded-md text-sm font-medium transition-all ${location.pathname.endsWith('invoices')
                            ? 'bg-white text-black shadow-sm'
                            : 'text-muted-foreground hover:text-black hover:bg-white/50'
                            }`}
                    >
                        Invoices
                    </Link>
                </div>
            </div>

            <Outlet />
        </div>
    )
}
