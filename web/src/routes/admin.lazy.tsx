import { createLazyFileRoute, Outlet, useRouter } from '@tanstack/react-router'
import { useAuth } from '../auth'
import { AdminSidebar } from "@/components/admin-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"

export const Route = createLazyFileRoute('/admin')({
    component: AdminLayout,
})

function AdminLayout() {
    const { user, logout } = useAuth()
    const router = useRouter()
    // Use useNavigate from the route
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
            <AdminSidebar variant="inset" user={sidebarUser} onLogout={handleLogout} />
            <SidebarInset>
                <SiteHeader />
                <Outlet />
            </SidebarInset>
        </SidebarProvider>
    )
}
