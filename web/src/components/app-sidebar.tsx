import * as React from "react"
import {
  IconHistory,
  IconLayoutDashboard,
  IconMail,
  IconSettings,
  IconStar,
  IconUserCircle,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
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
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {

      title: "Dashboard",
      url: "/dashboard",
      icon: IconLayoutDashboard,
    },
    {
      title: "Profile",
      url: "/profile",
      icon: IconUserCircle,
    },
    {
      title: "Transaction History",
      url: "/transaction-history",
      icon: IconHistory,
    },
    {
      title: "Campaign",
      url: "/campaign",
      icon: IconStar,
    }
  ],
  navSecondary: [
    {
      title: "Contact Us",
      url: "/contact-us",
      icon: IconMail,
    },
    {
      title: "Settings",
      url: "#",
      icon: IconSettings,
    },
  ],
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: {
    name: string
    email: string
    avatar: string
  }
  onLogout?: () => void
  navMain?: typeof data.navMain
}

export function AppSidebar({
  user,
  onLogout,
  navMain,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="/">
                <span className="text-2xl font-bold text-primary ml-1">realX</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain || data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user || data.user} onLogout={onLogout} />
      </SidebarFooter>
    </Sidebar>
  )
}
