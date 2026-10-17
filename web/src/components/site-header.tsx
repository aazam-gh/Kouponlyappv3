import { Link, useLocation } from '@tanstack/react-router'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Fragment } from 'react'
import { adminBreadcrumbs } from '@/lib/admin-navigation'
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'

export function SiteHeader() {
  const { pathname } = useLocation()
  const isAdmin = pathname.startsWith('/admin')
  const crumbs = adminBreadcrumbs(pathname)
  return <header className="sticky top-0 z-20 flex min-h-(--header-height) shrink-0 items-center gap-2 border-b border-border/80 bg-white/95 py-2 backdrop-blur-sm">
    <div className="flex w-full items-center gap-3 px-4 lg:px-8">
      <SidebarTrigger className="-ml-1" />
      {isAdmin ? <Breadcrumb><BreadcrumbList>
        {crumbs.map((crumb, index) => <Fragment key={crumb.url}>
          {index > 0 && <BreadcrumbSeparator />}
          <BreadcrumbItem>{index === crumbs.length - 1 ? <BreadcrumbPage>{crumb.title}</BreadcrumbPage> : <BreadcrumbLink asChild><Link to={crumb.url}>{crumb.title}</Link></BreadcrumbLink>}</BreadcrumbItem>
        </Fragment>)}
      </BreadcrumbList></Breadcrumb> : <span className="text-sm font-medium text-foreground">Kouponly</span>}
    </div>
  </header>
}
