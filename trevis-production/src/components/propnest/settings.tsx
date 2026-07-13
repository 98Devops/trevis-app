import { Panel } from "./panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ExternalLinkIcon, MoonIcon, SunIcon, UserIcon, BellIcon, ShieldIcon,
  SlidersHorizontalIcon, WrenchIcon, Loader2Icon, SaveIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { BRAND_NAME } from "@/lib/brand";
import { toast } from "sonner";
// Engine modules (brief §3) — consumed without modification.
import { useAuth, useData, getSettings, updateSetting } from "@/parts/p1_imports_context.jsx";
import { usePortfolioCoverage } from "./coverage-context";
import { repairAllStudentsCoverage } from "@/services/coverageRepairService.js";

const KEY = "propnest:theme";

export function Settings() {
  const auth = useAuth() as { user?: { email?: string; role?: string } | null } | null;
  const user = auth?.user ?? null;
  const isAdmin = user?.role?.toUpperCase() === "ADMIN";
  const [mode, setMode] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem(KEY);
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
    try { window.localStorage.setItem(KEY, mode); } catch { /* ignore */ }
  }, [mode]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            <span className="text-brand-gradient">Settings</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Account, appearance, and system preferences.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={`${window.location.pathname}?legacy=1`}>
            <ExternalLinkIcon /> Open full settings (legacy)
          </a>
        </Button>
      </header>

      <Panel stripe>
        <header className="border-b px-5 py-4">
          <h3 className="text-base font-semibold text-foreground">Account</h3>
          <p className="text-xs text-muted-foreground">Signed in via Supabase auth.</p>
        </header>
        <div className="space-y-4 px-5 py-5">
          <Row icon={<UserIcon className="size-4" />} label="Email">
            <span className="font-medium text-foreground">{user?.email ?? "—"}</span>
          </Row>
          <Row icon={<ShieldIcon className="size-4" />} label="Role">
            <Badge variant={user?.role === "ADMIN" ? "default" : "secondary"}>{user?.role ?? "guest"}</Badge>
          </Row>
          <Row icon={<UserIcon className="size-4" />} label="Build">
            {/* Deploys are manual dist uploads — this is the only record of which
                commit is actually live. Injected by vite.config define. */}
            <span className="font-mono text-xs text-muted-foreground">
              {typeof __BUILD_SHA__ !== "undefined" ? `${__BUILD_SHA__} · ${__BUILD_TIME__} UTC` : "dev"}
            </span>
          </Row>
        </div>
      </Panel>

      <Panel>
        <header className="border-b px-5 py-4">
          <h3 className="text-base font-semibold text-foreground">Appearance</h3>
          <p className="text-xs text-muted-foreground">Light or dark — persisted to this browser.</p>
        </header>
        <div className="flex items-center justify-between gap-4 px-5 py-5">
          <div className="text-sm text-muted-foreground">
            Currently using <span className="font-medium text-foreground capitalize">{mode}</span> mode
          </div>
          <div className="inline-flex overflow-hidden rounded-lg border">
            {(["light", "dark"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                  mode === m
                    ? "bg-brand-gradient text-white"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {m === "light" ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
                <span className="capitalize">{m}</span>
              </button>
            ))}
          </div>
        </div>
      </Panel>

      {isAdmin && <SystemSettingsPanel />}
      {isAdmin && <MaintenancePanel />}

      <Panel>
        <header className="border-b px-5 py-4">
          <h3 className="text-base font-semibold text-foreground">Notifications</h3>
          <p className="text-xs text-muted-foreground">Coverage reminders and weekly digests — coming soon.</p>
        </header>
        <div className="space-y-3 px-5 py-5">
          <Row icon={<BellIcon className="size-4" />} label="Coverage expiring">
            <Badge variant="outline">Not yet enabled</Badge>
          </Row>
          <Row icon={<BellIcon className="size-4" />} label="Weekly digest">
            <Badge variant="outline">Not yet enabled</Badge>
          </Row>
        </div>
      </Panel>
    </div>
  );
}

/** §15 #5 — editable white-label system settings, persisted to the `settings` table. */
function SystemSettingsPanel() {
  const [systemName, setSystemName] = useState("");
  const [currency, setCurrency] = useState("");
  const [country, setCountry] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = (await getSettings()) as unknown as { data: Record<string, string> };
      if (cancelled) return;
      setSystemName(data?.system_name ?? BRAND_NAME);
      setCurrency(data?.currency_symbol ?? "$");
      setCountry(data?.country_code ?? "");
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries: Array<[string, string]> = [
        ["system_name", systemName.trim()],
        ["currency_symbol", currency.trim() || "$"],
        ["country_code", country.trim()],
      ];
      for (const [k, v] of entries) {
        const { error } = (await updateSetting(k, v)) as { error: { message: string } | null };
        if (error) throw new Error(error.message);
      }
      toast.success("Settings saved", { description: "Reload to see name/currency changes everywhere." });
    } catch (err) {
      toast.error("Couldn't save settings", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel>
      <header className="flex items-center gap-2 border-b px-5 py-4">
        <span className="bg-brand-gradient-soft text-brand-blue flex size-8 items-center justify-center rounded-lg">
          <SlidersHorizontalIcon className="size-4" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-foreground">System</h3>
          <p className="text-xs text-muted-foreground">White-label name, currency, and country code.</p>
        </div>
      </header>
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="set-name">System name</Label>
          <Input id="set-name" value={systemName} disabled={!loaded || saving}
            onChange={(e) => setSystemName(e.target.value)} placeholder={BRAND_NAME} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="set-currency">Currency symbol</Label>
          <Input id="set-currency" value={currency} disabled={!loaded || saving} maxLength={4}
            onChange={(e) => setCurrency(e.target.value)} placeholder="$" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="set-country">Country code</Label>
          <Input id="set-country" value={country} disabled={!loaded || saving}
            onChange={(e) => setCountry(e.target.value)} placeholder="e.g. 1" />
        </div>
      </div>
      <footer className="flex justify-end border-t bg-card px-5 py-3">
        <Button variant="gradient" onClick={handleSave} disabled={!loaded || saving}>
          {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Save settings
        </Button>
      </footer>
    </Panel>
  );
}

/** §15 #4 — admin maintenance: rebuild every active occupant's coverage from the ledger. */
function MaintenancePanel() {
  const { refresh: refreshData } = useData() as unknown as { refresh: () => void };
  const { refresh: refreshCoverage } = usePortfolioCoverage() as unknown as { refresh: () => void };
  const [running, setRunning] = useState(false);

  const handleRepair = async () => {
    setRunning(true);
    try {
      const res = (await repairAllStudentsCoverage()) as {
        success: boolean; repaired: number; failed: number; errors: string[];
      };
      refreshData();
      refreshCoverage();
      if (res.success) {
        toast.success("Coverage repaired", { description: `${res.repaired} occupant${res.repaired === 1 ? "" : "s"} rebuilt from the ledger.` });
      } else {
        toast.warning("Repair finished with errors", {
          description: `${res.repaired} rebuilt · ${res.failed} failed. ${res.errors[0] ?? ""}`,
        });
      }
    } catch (err) {
      toast.error("Repair failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Panel>
      <header className="flex items-center gap-2 border-b px-5 py-4">
        <span className="bg-brand-gradient-soft text-brand-blue flex size-8 items-center justify-center rounded-lg">
          <WrenchIcon className="size-4" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-foreground">Maintenance</h3>
          <p className="text-xs text-muted-foreground">Rebuild coverage from the payment ledger (source of truth).</p>
        </div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
        <p className="max-w-md text-sm text-muted-foreground">
          Replays every active occupant's payment history through the coverage engine.
          Safe and idempotent — use it if a coverage badge ever looks out of sync. Takes ~10–30s.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={running}>
              {running ? <Loader2Icon className="animate-spin" /> : <WrenchIcon />} Repair coverage
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rebuild all coverage?</AlertDialogTitle>
              <AlertDialogDescription>
                This replays every active occupant's payments through the engine and overwrites the
                derived coverage cache. It never changes payments — only the computed coverage. Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={running}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); handleRepair(); }} disabled={running}>
                {running && <Loader2Icon className="animate-spin" />} Run repair
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Panel>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3 last:border-0 last:pb-0">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="bg-brand-gradient-soft text-brand-blue flex size-8 items-center justify-center rounded-lg">{icon}</span>
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
