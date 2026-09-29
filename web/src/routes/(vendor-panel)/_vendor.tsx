import { createFileRoute, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { useAuth } from '../../auth'

export const Route = createFileRoute('/(vendor-panel)/_vendor')({
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
  component: AuthLayout,
})

function AuthLayout() {
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
      <AppSidebar variant="inset" user={sidebarUser} onLogout={handleLogout} />
      <SidebarInset>
        <SiteHeader />
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
