import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronRight, ListOrdered, Image, FolderOpen, Sparkles, Tag, Store, Megaphone, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/admin/cms/')({ component: HomeContent })
const sections = [
  { title: 'Home section order', description: 'Rearrange every Home section, from partner banners to Top Brands.', icon: ListOrdered, href: '/admin/cms/home-layout' },
  { title: 'Partner banners', description: 'The carousel at the top of Home. Link each mobile image to a vendor.', icon: Image, href: '/admin/cms/banners' },
  { title: 'Categories & subcategories', description: 'The Home category grid and category filters. Vendors have one main category and multiple subcategories.', icon: FolderOpen, href: '/admin/cms/categories' },
  { title: 'Featured showcase', description: 'The large promotional carousel below new deals. Set images, linked vendors and slide order.', icon: Sparkles, href: '/admin/cms/featured-brand-showcase' },
  { title: 'New Deals', description: 'Choose active vendor offer cards and set their order in the New Deals section.', icon: Sparkles, href: '/admin/cms/new-deals' },
  { title: 'Trending Vendors', description: 'Choose vendors for the mobile app’s Trending Offers section and set their order.', icon: TrendingUp, href: '/admin/cms/trending-offers' },
  { title: 'App launch poster', description: 'Show a full-screen promotional poster once when a signed-in student opens Home, linked to a vendor.', icon: Megaphone, href: '/admin/cms/app-launch-poster' },
  { title: 'Brand logos', description: 'The Home brand grid. Set active logos and their linked vendors.', icon: Tag, href: '/admin/cms/brands' },
] as const

function HomeContent() {
  return <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-8">
    <div><h1 className="text-2xl font-semibold">Home content</h1><p className="mt-1 text-sm text-muted-foreground">Choose the part of the app you want to update. Changes appear in the student app.</p></div>
    <div className="divide-y overflow-hidden rounded-2xl border bg-card">
      {sections.map(section => <Link key={section.title} to={section.href}
        className="group flex items-center gap-4 p-5 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted"><section.icon className="size-5" /></span>
        <div className="min-w-0 flex-1"><h2 className="font-semibold">{section.title}</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">{section.description}</p></div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </Link>)}
    </div>
    <section className="flex flex-col gap-4 rounded-xl border border-dashed p-5 sm:flex-row sm:items-center">
      <Store className="size-6 shrink-0 text-muted-foreground" />
      <div className="flex-1"><h2 className="font-semibold">Nearby vendors</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Nearby cards use vendor branches and location details. Curate New Deals and Trending Vendors in their dedicated sections above.</p></div>
      <Button variant="outline" asChild><Link to="/admin/vendors" search={{ page: 1, pageSize: 10, search: '', sort: 'name-asc' }}>Manage vendors</Link></Button>
    </section>
  </div>
}
