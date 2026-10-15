import * as React from "react"
import {
  IconBell,
  IconHome,
  IconInfoCircle,
  IconMapPin,
  IconTicket,
  IconUsers,
} from "@tabler/icons-react"

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
    { title: "Home content", url: "/admin/cms", icon: IconInfoCircle },
    { title: "Explore & vendors", url: "/admin/vendors", icon: IconMapPin },
    { title: "Students & profiles", url: "/admin/students", icon: IconUsers },
    { title: "Coupons & referrals", url: "/admin/membership", icon: IconTicket },
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
              <a href="/">
                <span className="grid size-8 place-items-center rounded-lg bg-[#18B852] text-sm font-black text-[#0A0F0C]">K</span>
                <span className="font-heading text-xl tracking-tight text-sidebar-foreground">Kouponly</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="px-2 pt-1 text-xs text-muted-foreground">Free Kouponly membership</p>
      </SidebarHeader>
      <SidebarContent className="mt-3 px-2">
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter className="mb-2 border-t border-sidebar-border/70 p-4 pt-3">
        <NavUser user={user || data.user} onLogout={onLogout} />
      </SidebarFooter>
    </Sidebar>
  )
}
