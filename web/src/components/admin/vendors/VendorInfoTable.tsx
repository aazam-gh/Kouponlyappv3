import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'
import type { Vendor } from '@/queries'

interface VendorInfoTableProps {
    vendor: Vendor
    vendorId: string
    brandingPath: '/admin/vendors/$vendorId/settings/branding' | '/admin/online-vendors/$vendorId/settings/branding'
}

function formatList(values?: string[]) {
    if (!values || values.length === 0) return '—'
    return values.join(', ')
}

function formatValue(value?: string | number | boolean | null) {
    if (value === null || value === undefined || value === '') return '—'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    return String(value)
}

export function VendorInfoTable({ vendor, vendorId, brandingPath }: VendorInfoTableProps) {
    const vendorType = vendor.vendorType || 'in_store'

    return (
        <div className="space-y-6 pt-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-medium text-muted-foreground">Online vendor overview</p>
                    <h2 className="text-2xl font-bold tracking-tight">{vendor.name || 'Vendor'}</h2>
                </div>
                <Button asChild variant="outline" className="shrink-0">
                    <Link to={brandingPath} params={{ vendorId }}>
                        Edit Branding
                    </Link>
                </Button>
            </div>

            <div className="overflow-hidden rounded-[1.5rem] border bg-white shadow-sm">
                <table className="w-full text-sm">
                    <tbody className="divide-y">
                        <tr>
                            <th className="w-56 px-6 py-4 text-left font-medium text-muted-foreground">Vendor Name</th>
                            <td className="px-6 py-4 font-medium text-foreground">{formatValue(vendor.name)}</td>
                        </tr>
                        <tr>
                            <th className="px-6 py-4 text-left font-medium text-muted-foreground">Arabic Name</th>
                            <td className="px-6 py-4 font-medium text-foreground">{formatValue(vendor.nameAr)}</td>
                        </tr>
                        <tr>
                            <th className="px-6 py-4 text-left font-medium text-muted-foreground">Contact</th>
                            <td className="px-6 py-4 font-medium text-foreground">{formatValue(vendor.contact)}</td>
                        </tr>
                        <tr>
                            <th className="px-6 py-4 text-left font-medium text-muted-foreground">Email</th>
                            <td className="px-6 py-4 font-medium text-foreground">{formatValue(vendor.email)}</td>
                        </tr>
                        <tr>
                            <th className="px-6 py-4 text-left font-medium text-muted-foreground">Vendor Type</th>
                            <td className="px-6 py-4">
                                <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                                    {vendorType.replace('_', ' ')}
                                </Badge>
                            </td>
                        </tr>
                        <tr>
                            <th className="px-6 py-4 text-left font-medium text-muted-foreground">Status</th>
                            <td className="px-6 py-4 font-medium text-foreground">{formatValue(vendor.status)}</td>
                        </tr>
                        <tr>
                            <th className="px-6 py-4 text-left font-medium text-muted-foreground">Main Category</th>
                            <td className="px-6 py-4 font-medium text-foreground">{formatValue(vendor.mainCategory)}</td>
                        </tr>
                        <tr>
                            <th className="px-6 py-4 text-left font-medium text-muted-foreground">Subcategories</th>
                            <td className="px-6 py-4 font-medium text-foreground">{formatList(vendor.subcategory)}</td>
                        </tr>
                        <tr>
                            <th className="px-6 py-4 text-left font-medium text-muted-foreground">Search Tokens</th>
                            <td className="px-6 py-4 font-medium text-foreground">{formatList(vendor.searchTokens)}</td>
                        </tr>
                        <tr>
                            <th className="px-6 py-4 text-left font-medium text-muted-foreground">Trending</th>
                            <td className="px-6 py-4 font-medium text-foreground">{formatValue(vendor.isTrending)}</td>
                        </tr>
                        <tr>
                            <th className="px-6 py-4 text-left font-medium text-muted-foreground">XCard</th>
                            <td className="px-6 py-4 font-medium text-foreground">{formatValue(vendor.xcard)}</td>
                        </tr>
                        <tr>
                            <th className="px-6 py-4 text-left font-medium text-muted-foreground">Vendor ID</th>
                            <td className="px-6 py-4 font-mono text-xs text-foreground">{vendorId}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    )
}
