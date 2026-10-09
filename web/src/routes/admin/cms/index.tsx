import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronRight, Image, FolderOpen, MapPin, Sparkles, Tag, TrendingUp, Store } from 'lucide-react'

export const Route = createFileRoute('/admin/cms/')({ component: HomeContent })
const sections = [
  { title: 'Partner banners', description: 'The carousel at the top of Home. Link each mobile image to a vendor.', icon: Image, href: '/admin/cms/banners' },
  { title: 'Categories & subcategories', description: 'The Home category grid and category filters. Vendors have one main category and multiple subcategories.', icon: FolderOpen, href: '/admin/cms/categories' },
  { title: 'Nearby vendors', description: 'Food vendors near the student. Update branch coordinates, addresses and cover images.', icon: MapPin, href: '/admin/vendors' },
  { title: 'New deals', description: 'Current vendor offers. Manage offer availability, terms and vendor presentation.', icon: Store, href: '/admin/vendors' },
  { title: 'Featured showcase', description: 'The large promotional carousel below new deals. Set images, linked vendors and slide order.', icon: Sparkles, href: '/admin/cms/featured-brand-showcase' },
  { title: 'Trending offers', description: 'Current vendor offers with trending vendors first. Use the Trending toggle in vendor settings.', icon: TrendingUp, href: '/admin/vendors' },
  { title: 'Brand logos', description: 'The Home brand grid. Set active logos and their linked vendors.', icon: Tag, href: '/admin/cms/brands' },
] as const

function HomeContent() {
  return <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-8">
    <div><h1 className="text-2xl font-semibold">Home content</h1><p className="mt-1 text-sm text-muted-foreground">Manage the sections in the order students see them in the mobile app.</p></div>
    <div className="divide-y overflow-hidden rounded-2xl border bg-card">
      {sections.map(section => <Link key={section.title} to={section.href}
        search={section.href === '/admin/vendors' ? { page: 1, pageSize: 10, search: '', sort: 'name-asc' } : undefined}
        className="group flex items-center gap-4 p-5 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted"><section.icon className="size-5" /></span>
        <div className="min-w-0 flex-1"><h2 className="font-semibold">{section.title}</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">{section.description}</p></div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </Link>)}
    </div>
  </div>
}
