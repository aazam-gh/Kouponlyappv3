import { type Icon } from "@tabler/icons-react"
import { Link, useLocation } from "@tanstack/react-router"
import { matchesAdminPath } from '@/lib/admin-navigation'

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
    children?: { title: string; url: string }[]
  }[]
}) {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu className="gap-2">
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={matchesAdminPath(pathname, item.url) && !item.children?.some(child => matchesAdminPath(pathname, child.url))}
                asChild
                className="h-12 rounded-xl px-4 transition-colors data-[active=true]:bg-primary data-[active=true]:text-white data-[active=true]:hover:bg-primary/90 hover:bg-sidebar-accent group"
              >
                <Link
                  to={item.url}
                  onClick={() => setOpenMobile(false)}
                  activeOptions={{ exact: true }}
                  className="flex items-center gap-4 w-full"
                >
                  {item.icon && (
                    <item.icon
                      className="size-5 stroke-[1.7] transition-colors text-sidebar-foreground/75 group-data-[active=true]:text-white"
                    />
                  )}
                  <span className="text-sm font-semibold text-sidebar-foreground group-data-[active=true]:text-white">{item.title}</span>
                </Link>
              </SidebarMenuButton>
              {item.children && matchesAdminPath(pathname, item.url) && <SidebarMenuSub>
                {item.children.map(child => <SidebarMenuSubItem key={child.url}>
                  <SidebarMenuSubButton asChild isActive={matchesAdminPath(pathname, child.url)} className="h-auto min-h-9 py-2 data-[active=true]:bg-secondary data-[active=true]:font-semibold">
                    <Link to={child.url} onClick={() => setOpenMobile(false)}>{child.title}</Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>)}
              </SidebarMenuSub>}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
