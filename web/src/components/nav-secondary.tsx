"use client"

import * as React from "react"
import { type Icon } from "@tabler/icons-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import { Link } from "@tanstack/react-router"

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: Icon
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <Link
                  to={item.url}
                  activeProps={{ "data-active": "true" } as any}
                  className={
                    item.title === "Contact Us"
                      ? "data-[active=true]:bg-brand-green data-[active=true]:text-black data-[active=true]:before:hidden rounded-xl py-6"
                      : ""
                  }
                >
                  <item.icon className={item.title === "Contact Us" ? "!size-5" : ""} />
                  <span className={item.title === "Contact Us" ? "text-base font-semibold" : ""}>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
