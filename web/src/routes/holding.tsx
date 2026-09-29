import { createFileRoute, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { IconHistory, IconLayoutDashboard } from '@tabler/icons-react'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import {
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { useAuth } from '@/auth'

const holdingNav = [
  {
    title: 'Dashboard',
    url: '/holding/dashboard',
    icon: IconLayoutDashboard,
  },
  {
    title: 'Transactions',
    url: '/holding/transactions',
    icon: IconHistory,
  },
]

export const Route = createFileRoute('/holding')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: HoldingLayout,
})

function HoldingLayout() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const navigate = Route.useNavigate()

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout().then(() => {
        router.invalidate().finally(() => {
          navigate({ to: '/login' })
        })
      })
    }
  }

  const sidebarUser = {
    name: user?.displayName || 'User',
    email: user?.email || '',
    avatar: user?.photoURL || '',
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" user={sidebarUser} onLogout={handleLogout} navMain={holdingNav} />
      <SidebarInset>
        <SiteHeader />
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
