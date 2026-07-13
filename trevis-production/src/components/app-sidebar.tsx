"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { HomeIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { footerNavLinks, navGroups } from "@/components/app-shared";
import { NavGroup } from "@/components/nav-group";
import { useNav } from "@/lib/propnest-nav";
import { BRAND_NAME } from "@/lib/brand";

export function AppSidebar() {
  const { screen } = useNav();

  // Re-derive nav groups with the currently active item marked. NavGroup reads
  // `isActive` to render the highlight; sidebar items remain plain anchors so
  // the shell's hashchange listener can pick up the click and switch screens.
  const groups = useMemo(
    () =>
      navGroups.map((g) => ({
        ...g,
        items: g.items.map((it) => ({ ...it, isActive: it.screen === screen })),
      })),
    [screen],
  );

  return (
    <Sidebar
      className={cn(
        "*:data-[slot=sidebar-inner]:bg-background",
        "**:data-[slot=sidebar-menu-button]:[&>span]:text-foreground/75",
      )}
      collapsible="icon"
      variant="sidebar"
    >
      <SidebarHeader className="h-14 justify-center border-b px-2">
        <SidebarMenuButton asChild>
          <a href="#dashboard">
            <HomeIcon className="text-primary" />
            <span className="font-semibold text-foreground!">{BRAND_NAME}</span>
          </a>
        </SidebarMenuButton>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group, index) => (
          <NavGroup key={`sidebar-group-${index}`} {...group} />
        ))}
      </SidebarContent>
      <SidebarFooter className="gap-0 p-0">
        {footerNavLinks.length > 0 && (
          <SidebarMenu className="border-t p-2">
            {footerNavLinks.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  className="text-muted-foreground"
                  size="sm"
                >
                  <a href={item.path}>
                    {item.icon}
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        )}
        <div className="px-4 pt-4 pb-2 transition-opacity group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:opacity-0">
          <p className="text-nowrap text-[9px] text-muted-foreground">
            © {new Date().getFullYear()} {BRAND_NAME}
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
