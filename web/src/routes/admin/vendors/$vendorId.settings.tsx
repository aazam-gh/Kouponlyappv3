import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { vendorQueryOptions, type Vendor } from '@/queries'

export type { Vendor }

export const Route = createFileRoute('/admin/vendors/$vendorId/settings')({
    component: VendorSettingsLayout,
    loader: async ({ context: { queryClient }, params: { vendorId } }) => {
        await queryClient.ensureQueryData(vendorQueryOptions(vendorId))
    },
})

function VendorSettingsLayout() {
    const { vendorId } = Route.useParams()
    const location = useLocation()

    const { data: vendor } = useQuery(vendorQueryOptions(vendorId))

    return (
        <div className="p-4 sm:p-8 space-y-6 w-full max-w-[1200px] mx-auto">
            <div className="flex items-center gap-4">
                <Link
                    to="/admin/vendors"
                    search={{ page: 1, pageSize: 10, search: '', sort: 'name-asc' }}
                    aria-label="Back to vendors"
                    className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <span className="font-semibold">{vendor?.name || 'Vendor'}</span>
                    </h1>
                </div>
            </div>

            <div className="w-full border-b">
                <div className="flex w-full overflow-x-auto bg-muted/50 p-1 rounded-xl gap-1">
                    <Link
                        to="/admin/vendors/$vendorId/settings/branding"
                        params={{ vendorId }}
                        className={`min-w-36 flex-1 flex items-center justify-center h-10 rounded-md text-sm font-medium transition-all ${location.pathname.endsWith('branding')
                            ? 'bg-white text-black shadow-sm'
                            : 'text-muted-foreground hover:text-black hover:bg-white/50'
                            }`}
                    >
                        Profile & appearance
                    </Link>
                    <Link
                        to="/admin/vendors/$vendorId/settings/offers"
                        params={{ vendorId }}
                        className={`min-w-36 flex-1 flex items-center justify-center h-10 rounded-md text-sm font-medium transition-all ${location.pathname.endsWith('offers')
                            ? 'bg-white text-black shadow-sm'
                            : 'text-muted-foreground hover:text-black hover:bg-white/50'
                            }`}
                    >
                        Offers
                    </Link>
                    <Link
                        to="/admin/vendors/$vendorId/settings/location"
                        params={{ vendorId }}
                        className={`min-w-36 flex-1 flex items-center justify-center h-10 rounded-md text-sm font-medium transition-all ${location.pathname.endsWith('location')
                            ? 'bg-white text-black shadow-sm'
                            : 'text-muted-foreground hover:text-black hover:bg-white/50'
                            }`}
                    >
                        Branches & map
                    </Link>
                    <Link
                        to="/admin/vendors/$vendorId/settings/invoices"
                        params={{ vendorId }}
                        className={`min-w-36 flex-1 flex items-center justify-center h-10 rounded-md text-sm font-medium transition-all ${location.pathname.endsWith('invoices')
                            ? 'bg-white text-black shadow-sm'
                            : 'text-muted-foreground hover:text-black hover:bg-white/50'
                            }`}
                    >
                        Transactions
                    </Link>
                </div>
            </div>

            <Outlet />
        </div>
    )
}
