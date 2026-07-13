import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type ScreenKey =
  | "dashboard"
  | "properties"
  | "tenants"
  | "finance"
  | "reports"
  | "calendar"
  | "settings";

type NavContextValue = {
  screen: ScreenKey;
  setScreen: (s: ScreenKey) => void;
  /** Currently focused property in the Properties screen, if any. */
  selectedPropertyId: string | null;
  setSelectedPropertyId: (id: string | null) => void;
  /** Helper: jump straight to a property detail from anywhere (e.g. Dashboard). */
  openProperty: (id: string) => void;
  /** Tenant whose profile drawer should be open. */
  selectedTenantId: string | null;
  /** Open the tenant profile drawer from anywhere. */
  openTenant: (id: string) => void;
  closeTenant: () => void;
};

const NavContext = createContext<NavContextValue | null>(null);

export function NavProvider({ children, initial = "dashboard" }: { children: ReactNode; initial?: ScreenKey }) {
  const [screen, setScreen] = useState<ScreenKey>(initial);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const value = useMemo<NavContextValue>(
    () => ({
      screen,
      setScreen: (s) => {
        setScreen(s);
        if (s !== "properties") setSelectedPropertyId(null);
      },
      selectedPropertyId,
      setSelectedPropertyId,
      openProperty: (id) => {
        setSelectedPropertyId(id);
        setScreen("properties");
        if (typeof window !== "undefined") window.location.hash = "properties";
      },
      selectedTenantId,
      openTenant: (id) => setSelectedTenantId(id),
      closeTenant: () => setSelectedTenantId(null),
    }),
    [screen, selectedPropertyId, selectedTenantId],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav must be used inside <NavProvider>");
  return ctx;
}
