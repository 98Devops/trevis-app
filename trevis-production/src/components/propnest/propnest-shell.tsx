import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { NavProvider, useNav, type ScreenKey } from "@/lib/propnest-nav";
import { PropNestDashboard } from "./propnest-dashboard";
import { Properties } from "./properties";
import { Tenants } from "./tenants";
import { Finance } from "./finance";
import { Reports } from "./reports";
import { CalendarScreen } from "./calendar";
import { Settings } from "./settings";
import { TenantProfileDrawer } from "./modals/tenant-profile-drawer";
import { CoverageProvider } from "./coverage-context";
import { CoverageErrorBanner } from "./coverage-error-banner";
import { Loader2Icon } from "lucide-react";
// Engine modules (brief §3) — auth gate reuses the existing provider + login.
import { useAuth } from "@/parts/p1_imports_context.jsx";
import { LoginScreen } from "./login-screen";
import { isConfigured } from "@/lib/supabase";

type AuthCtx = {
  user: { id?: string; email?: string; role?: string } | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ data: unknown; error: { message: string } | null }>;
  setUser: (u: unknown) => void;
};

const VALID_SCREENS: ScreenKey[] = [
  "dashboard", "properties", "tenants", "finance", "reports", "calendar", "settings",
];

function readHashScreen(): ScreenKey {
  const raw = window.location.hash.replace(/^#\/?/, "") as ScreenKey;
  return (VALID_SCREENS as string[]).includes(raw) ? raw : "dashboard";
}

function ScreenSwitcher() {
  const { screen, setScreen } = useNav();

  useEffect(() => {
    const sync = () => setScreen(readHashScreen());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [setScreen]);

  switch (screen) {
    case "dashboard":  return <PropNestDashboard />;
    case "properties": return <Properties />;
    case "tenants":    return <Tenants />;
    case "finance":    return <Finance />;
    case "reports":    return <Reports />;
    case "calendar":   return <CalendarScreen />;
    case "settings":   return <Settings />;
    default:           return <PropNestDashboard />;
  }
}

export function PropNestShell() {
  // Auth gate — mirrors legacy App.jsx so a signed-out user gets the login screen
  // instead of an empty dashboard. Reuses the existing LoginScreen + auth context.
  const auth = useAuth() as unknown as AuthCtx;

  // Demo mode passes a user object; configured mode passes (email, password).
  const handleLogin = async (emailOrUser: string | object, password?: string) => {
    if (!isConfigured) { auth.setUser(emailOrUser); return { data: emailOrUser, error: null }; }
    return auth.login(emailOrUser as string, password ?? "");
  };

  if (auth.loading) {
    return (
      <div className="bg-page-gradient flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2Icon className="size-5 animate-spin text-brand-blue" />
          <span className="text-sm font-medium">Loading PropNest…</span>
        </div>
      </div>
    );
  }

  if (!auth.user) {
    return <LoginScreen onLogin={handleLogin} isConfigured={isConfigured} />;
  }

  return (
    <CoverageProvider>
      <NavProvider initial={readHashScreen()}>
        <AppShell>
          <div className="bg-page-gradient -m-4 min-h-[calc(100vh-3.5rem)] p-4 md:-m-6 md:p-6">
            <CoverageErrorBanner />
            <ScreenSwitcher />
          </div>
          {/* Shell-level drawer — any screen can call openTenant(id) */}
          <TenantProfileDrawer />
        </AppShell>
      </NavProvider>
    </CoverageProvider>
  );
}

export default PropNestShell;
