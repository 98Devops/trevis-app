import type { ReactNode } from "react";
import {
  LayoutGridIcon,
  Building2Icon,
  UsersIcon,
  WalletIcon,
  BarChart3Icon,
  CalendarDaysIcon,
  SettingsIcon,
} from "lucide-react";
import type { ScreenKey } from "@/lib/propnest-nav";
import { ACTIVE_LABELS } from "@/lib/vertical-labels";

export type SidebarNavItem = {
  title: string;
  /** PropNest screen key — used by the shell to switch views. Anchor href is derived from this. */
  screen?: ScreenKey;
  path?: string;
  icon?: ReactNode;
  isActive?: boolean;
  subItems?: SidebarNavItem[];
};

export type SidebarNavGroup = {
  label?: string;
  items: SidebarNavItem[];
};

export const navGroups: SidebarNavGroup[] = [
  {
    label: "Portfolio",
    items: [
      { title: "Dashboard",  screen: "dashboard",  path: "#dashboard",  icon: <LayoutGridIcon /> },
      { title: "Properties", screen: "properties", path: "#properties", icon: <Building2Icon /> },
      { title: ACTIVE_LABELS.occupantPlural, screen: "tenants", path: "#tenants", icon: <UsersIcon /> },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Finance",  screen: "finance",  path: "#finance",  icon: <WalletIcon /> },
      { title: "Reports",  screen: "reports",  path: "#reports",  icon: <BarChart3Icon /> },
      { title: "Calendar", screen: "calendar", path: "#calendar", icon: <CalendarDaysIcon /> },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Settings", screen: "settings", path: "#settings", icon: <SettingsIcon /> },
    ],
  },
];

// No template "Help Center" / "Documentation" placeholders — this is Trevis's
// real system. Kept as an (empty) export so navLinks below stays valid.
export const footerNavLinks: SidebarNavItem[] = [];

export const navLinks: SidebarNavItem[] = [
  ...navGroups.flatMap((group) =>
    group.items.flatMap((item) =>
      item.subItems?.length ? [item, ...item.subItems] : [item],
    ),
  ),
  ...footerNavLinks,
];
