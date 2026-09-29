import * as React from "react"
import {
  IconBell,
  IconClipboardCheck,
  IconDatabase,
  IconHome,
  IconInfoCircle,
  IconGift,
  IconReceipt,
  IconSparkles,
  IconShield,
  IconShoppingBag,
  IconBuildingStore,
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
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/admin/dashboard",
      icon: IconHome,
    },
    {
      title: "Daily Transactions",
      url: "/admin/transactions",
      icon: IconReceipt,
    },
    {
      title: "Transactions",
      url: "/admin/bigquery-transactions",
      icon: IconDatabase,
    },
    {
      title: "Vendors",
      url: "/admin/vendors",
      icon: IconShield,
    },
    {
      title: "Online Vendors",
      url: "/admin/online-vendors",
      icon: IconShoppingBag,
    },
    {
      title: "Holding Groups",
      url: "/admin/holding-groups",
      icon: IconBuildingStore,
    },
    {
      title: "Students",
      url: "/admin/students",
      icon: IconUsers,
    },
    {
      title: "Verification Requests",
      url: "/admin/verification-requests",
      icon: IconClipboardCheck,
    },
    {
      title: "Wakti",
      url: "/admin/wakti",
      icon: IconSparkles,
    },
    {
      title: "App CMS",
      url: "/admin/cms",
      icon: IconInfoCircle,
    },
    {
      title: "Notifications",
      url: "/admin/notifications",
      icon: IconBell,
    },
    {
      title: "Badrgo Vouchers",
      url: "/admin/pilot-campaign",
      icon: IconGift,
    },
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
      <SidebarHeader className="pt-6 px-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="hover:bg-transparent"
            >
              <a href="/">
                <span className="text-3xl font-black text-primary tracking-tighter">realX</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="px-2 mt-4">
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter className="p-4 mb-4">
        <NavUser user={user || data.user} onLogout={onLogout} />
      </SidebarFooter>
    </Sidebar>
  )
}
