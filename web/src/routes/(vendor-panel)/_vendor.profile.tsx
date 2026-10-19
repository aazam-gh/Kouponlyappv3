import { createFileRoute } from '@tanstack/react-router'
import { VendorCredentials } from '@/components/vendor-credentials'
import { useQuery } from '@tanstack/react-query'
import { vendorQueryOptions } from '@/queries'
import { useAuth } from '@/auth'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/(vendor-panel)/_vendor/profile')({
  component: VendorProfile,
})

function VendorProfile() {
  const { user } = useAuth()
  const vendorId = user?.uid || ''

  const { data: vendor, isLoading } = useQuery(vendorQueryOptions(vendorId))

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  if (!vendor) {
    return <div className="p-6">Vendor profile not found.</div>
  }

  const info = [
    ['Name', vendor.name],
    ['Username', vendor.username],
    ['Email', vendor.email],
    ['Phone', vendor.phoneNumber],
    ['Website', vendor.website],
    ['Status', vendor.status],
    ['Vendor Type', vendor.vendorType],
    ['Main Category', vendor.mainCategory],
    ['Address', vendor.address],
  ]

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          {vendor.profilePicture ? (
            <img
              src={vendor.profilePicture}
              alt={vendor.name || 'Vendor logo'}
              className="h-20 w-20 rounded-xl object-cover border"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl border bg-gray-100 text-sm text-gray-500">
              No Logo
            </div>
          )}

          <div>
            <h2 className="text-xl font-semibold">{vendor.name || 'Unnamed Vendor'}</h2>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Vendor Information</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {info.map(([label, value]) => (
            <div key={label} className="rounded-lg border p-4">
              <p className="text-sm text-gray-500">{label}</p>
              <p className="font-medium">{value || '-'}</p>
            </div>
          ))}
        </div>
      </div>
      <VendorCredentials />
    </div>
  )
}
