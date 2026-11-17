import * as React from "react"
import {
  IconHistory,
  IconLayoutDashboard,
  IconLogout,
  IconMail,
  IconStar,
  IconUserCircle,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  const activeUser = user || data.user

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
                <span className="text-2xl font-bold text-primary ml-1">Kouponly</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain || data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
        <div className="px-2 pb-3">
          <button type="button" onClick={onLogout} className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-red-600 px-4 py-3 text-left text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">
            <IconLogout className="size-5" />
            Log out
          </button>
        </div>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex min-w-0 items-center gap-3 px-2 py-2">
          <Avatar className="size-8 shrink-0 rounded-lg grayscale">
            <AvatarImage src={activeUser.avatar} alt={activeUser.name} />
            <AvatarFallback className="rounded-lg">CN</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{activeUser.name}</span>
            <span className="truncate text-xs text-muted-foreground">{activeUser.email}</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
