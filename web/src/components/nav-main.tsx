import { type Icon } from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"

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
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu className="gap-3">
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                asChild
                className="h-12 px-4 rounded-xl transition-all data-[active=true]:bg-brand-green data-[active=true]:text-white data-[active=true]:hover:bg-brand-green/90 hover:bg-slate-100 group"
              >
                <Link
                  to={item.url}
                  activeProps={{ "data-active": "true" } as any}
                  className="flex items-center gap-4 w-full"
                >
                  {item.icon && (
                    <item.icon
                      className="size-6 stroke-[1.5] transition-colors group-data-[active=true]:text-white"
                    />
                  )}
                  <span className="font-bold text-base text-slate-900 group-data-[active=true]:text-white">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
