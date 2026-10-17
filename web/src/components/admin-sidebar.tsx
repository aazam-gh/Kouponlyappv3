import * as React from "react"
import {
  IconBell,
  IconHome,
  IconInfoCircle,
  IconMapPin,
  IconUsers,
  IconReceipt,
} from "@tabler/icons-react"
import { Link } from '@tanstack/react-router'
import { homeContentLinks } from '@/lib/admin-navigation'

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "Administrator",
    email: "",
    avatar: "",
  },
  navMain: [
    { title: "Overview", url: "/admin/dashboard", icon: IconHome },
    { title: "Vendors & offers", url: "/admin/vendors", icon: IconMapPin },
    { title: "Students", url: "/admin/students", icon: IconUsers },
    { title: "Transactions", url: "/admin/transactions", icon: IconReceipt },
  ],
  navContent: [
    { title: "Home content", url: "/admin/cms", icon: IconInfoCircle, children: homeContentLinks },
    { title: "Notifications", url: "/admin/notifications", icon: IconBell },
  ],
}

interface AdminSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: {
    name: string
    email: string
    avatar: string
  }
  onLogout?: () => void
}

export function AdminSidebar({
  user,
  onLogout,
  ...props
}: AdminSidebarProps) {
  return (
    <Sidebar collapsible="offcanvas" className="border-none" {...props}>
      <SidebarHeader className="border-b border-sidebar-border/70 px-4 pb-5 pt-6">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="hover:bg-transparent"
            >
              <Link to="/admin/dashboard">
                <span className="grid size-8 place-items-center rounded-lg bg-[#18B852] text-sm font-black text-[#0A0F0C]">K</span>
                <span className="text-xl font-bold tracking-tight text-sidebar-foreground">Kouponly</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="px-2 pt-1 text-xs text-muted-foreground">Admin workspace</p>
      </SidebarHeader>
      <SidebarContent className="mt-3 px-2">
        <NavMain items={data.navMain} />
        <div className="mt-3 border-t border-sidebar-border pt-3">
          <p className="px-5 text-xs font-medium text-muted-foreground">App management</p>
          <NavMain items={data.navContent} />
        </div>
      </SidebarContent>
      <SidebarFooter className="mb-2 border-t border-sidebar-border/70 p-4 pt-3">
        <NavUser user={user || data.user} onLogout={onLogout} />
      </SidebarFooter>
    </Sidebar>
  )
}
