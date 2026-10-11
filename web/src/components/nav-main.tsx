import { type Icon } from "@tabler/icons-react"
import { Link, useLocation } from "@tanstack/react-router"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
  }[]
}) {
  const { pathname } = useLocation()
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={pathname.startsWith(item.url) || (item.url === '/admin/membership' && pathname.startsWith('/admin/transactions'))}
                asChild
                className="h-11 rounded-xl px-3 transition-colors data-[active=true]:bg-[#B7F52B] data-[active=true]:text-[#0A0F0C] data-[active=true]:hover:bg-[#A8E521] hover:bg-sidebar-accent group"
              >
                <Link
                  to={item.url}
                  activeProps={{ "data-active": "true" } as any}
                  className="flex items-center gap-4 w-full"
                >
                  {item.icon && (
                    <item.icon
                      className="size-5 stroke-[1.7] transition-colors text-sidebar-foreground/75 group-data-[active=true]:text-[#0A0F0C]"
                    />
                  )}
                  <span className="text-sm font-medium text-sidebar-foreground group-data-[active=true]:text-[#0A0F0C]">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
