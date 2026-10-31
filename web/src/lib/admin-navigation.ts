export const homeContentLinks = [
  { title: 'Home screen layout', url: '/admin/cms/home-layout' },
  { title: 'Partner banners', url: '/admin/cms/banners' },
  { title: 'Featured showcase', url: '/admin/cms/featured-brand-showcase' },
  { title: 'New Deals', url: '/admin/cms/new-deals' },
  { title: 'Trending Offers', url: '/admin/cms/trending-offers' },
  { title: 'App launch poster', url: '/admin/cms/app-launch-poster' },
  { title: 'Top Brands', url: '/admin/cms/brands' },
  { title: 'Categories', url: '/admin/cms/categories' },
]

export function matchesAdminPath(pathname: string, url: string) {
  return pathname === url || pathname.startsWith(`${url}/`)
}

const sections = [
  { title: 'Overview', url: '/admin/dashboard' },
  { title: 'Vendors & offers', url: '/admin/vendors' },
  { title: 'Students', url: '/admin/students' },
  { title: 'Transactions', url: '/admin/transactions' },
  { title: 'Allowed email domains', url: '/admin/school-domains' },
  { title: 'Vendor Requests', url: '/admin/vendor-requests' },
  { title: 'Home content', url: '/admin/cms' },
  { title: 'Notifications', url: '/admin/notifications' },
]

export function adminBreadcrumbs(pathname: string) {
  const section = sections.find(item => matchesAdminPath(pathname, item.url))
  if (!section) return [{ title: 'Overview', url: '/admin/dashboard' }]
  const crumbs = [section]
  const content = homeContentLinks.find(item => matchesAdminPath(pathname, item.url))
  if (content) crumbs.push(content)
  if (pathname.endsWith('/add')) crumbs.push({ title: 'Add new', url: pathname })
  else if (content?.url === '/admin/cms/categories' && pathname.replace(/\/$/, '') !== content.url) {
    crumbs.push({ title: 'Edit category', url: pathname })
  } else if (matchesAdminPath(pathname, '/admin/vendors') && pathname.includes('/settings')) {
    const tab = pathname.split('/').pop()
    const titles: Record<string, string> = { branding: 'Profile & appearance', offers: 'Offers', location: 'Branches & map', invoices: 'Transactions' }
    crumbs.push({ title: titles[tab ?? ''] ?? 'Vendor settings', url: pathname })
  } else if (matchesAdminPath(pathname, '/admin/students') && pathname.endsWith('/settings')) {
    crumbs.push({ title: 'Student profile', url: pathname })
  } else if (matchesAdminPath(pathname, '/admin/transactions') && pathname.replace(/\/$/, '') !== section.url) {
    crumbs.push({ title: 'Transaction details', url: pathname })
  }
  return crumbs
}
