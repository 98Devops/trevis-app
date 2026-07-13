"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserIcon, SettingsIcon, LogOutIcon, ChevronDownIcon } from "lucide-react";
import { useAuth } from "@/parts/p1_imports_context.jsx";

export function NavUser() {
  const auth = useAuth() as unknown as { user?: { email?: string; role?: string } | null; logout?: () => Promise<void> | void } | null;
  const user = auth?.user ?? null;
  const email = user?.email ?? "guest@propnest.app";
  const role = user?.role ?? "guest";
  const initial = (email[0] || "U").toUpperCase();

  const handleLogout = async () => {
    try { await auth?.logout?.(); } catch (e) { console.error(e); }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-2 py-1 transition-colors hover:bg-muted"
          aria-label="Account menu"
        >
          <Avatar className="size-7">
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[140px] truncate text-sm font-medium text-foreground sm:inline">
            {email}
          </span>
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{email}</div>
            <div className="text-muted-foreground text-xs uppercase tracking-wide">{role}</div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => { window.location.hash = "settings"; }}>
            <UserIcon />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { window.location.hash = "settings"; }}>
            <SettingsIcon />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="w-full cursor-pointer"
          variant="destructive"
          onClick={handleLogout}
        >
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
