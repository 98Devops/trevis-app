import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { navLinks } from "@/components/app-shared";
import { CustomSidebarTrigger } from "@/components/custom-sidebar-trigger";
import { NavUser } from "@/components/nav-user";
import { BellIcon } from "lucide-react";
import { useNav } from "@/lib/propnest-nav";
import { ThemeToggle } from "@/components/propnest/theme-toggle";

export function AppHeader() {
  const { screen } = useNav();
  const activeItem = navLinks.find((item) => item.screen === screen) ?? null;

  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 md:px-6",
        "bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/50",
      )}
    >
      <div className="flex items-center gap-3">
        <CustomSidebarTrigger />
        <Separator
          className="mr-2 h-4 data-[orientation=vertical]:self-center"
          orientation="vertical"
        />
        <AppBreadcrumbs page={activeItem ? { title: activeItem.title, icon: activeItem.icon } : undefined} />
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Button aria-label="Notifications" size="icon-sm" variant="outline">
          <BellIcon />
        </Button>
        <Separator
          className="h-4 data-[orientation=vertical]:self-center"
          orientation="vertical"
        />
        <NavUser />
      </div>
    </header>
  );
}
