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
  return <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border/80 bg-white/90 backdrop-blur-sm">
    <div className="flex w-full items-center gap-3 px-4 lg:px-8">
      <SidebarTrigger className="-ml-1" />
      <span className="text-sm font-medium text-foreground">{title}</span>
      {isAdmin && <Link to="/admin/membership" className="ml-auto rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">Free Rajagiri MVP</Link>}
    </div>
  </header>
}
