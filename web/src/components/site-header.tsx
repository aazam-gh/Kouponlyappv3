import { Link, useLocation } from '@tanstack/react-router'
import { SidebarTrigger } from '@/components/ui/sidebar'

export function SiteHeader() {
  const { pathname } = useLocation()
  const isAdmin = pathname.startsWith('/admin')
  const title = !isAdmin ? 'Kouponly' : pathname.startsWith('/admin/cms') ? 'Home content'
    : pathname.startsWith('/admin/vendors') ? 'Explore & vendors'
    : pathname.startsWith('/admin/students') ? 'Students & profiles'
    : pathname.startsWith('/admin/membership') || pathname.startsWith('/admin/transactions') ? 'Coupons & referrals'
    : pathname.startsWith('/admin/notifications') ? 'Notifications' : 'Overview'
  return <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b">
    <div className="flex w-full items-center gap-3 px-4 lg:px-6">
      <SidebarTrigger className="-ml-1" /><span className="text-sm font-medium">{title}</span>
      {isAdmin && <Link to="/admin/membership" className="ml-auto rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Free Rajagiri MVP</Link>}
    </div>
  </header>
}
