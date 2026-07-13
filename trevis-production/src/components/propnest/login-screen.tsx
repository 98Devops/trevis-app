import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2Icon, Loader2Icon, AlertTriangleIcon } from "lucide-react";
// Engine modules (brief §3) — consumed without modification.
import { useAuth } from "@/parts/p1_imports_context.jsx";
import { supabase, isConfigured as sbConfigured } from "@/lib/supabase";
import { BRAND_NAME } from "@/lib/brand";

type LoginResult = { data: unknown; error: { message: string } | null };
type DemoUser = { email: string; password: string; role: string; full_name: string };

const DEMO_USERS: DemoUser[] = [
  { email: "admin@propnest.app", password: "admin1234", role: "ADMIN", full_name: "Admin" },
  { email: "manager@propnest.app", password: "manager1234", role: "MANAGER", full_name: "Manager" },
];

/**
 * PropNest-branded sign-in. Drop-in for the legacy LoginScreen: same `onLogin`
 * contract — called with a user object in demo mode, or (email, password)
 * returning { data, error } when Supabase is configured.
 */
export function LoginScreen({
  onLogin,
  isConfigured,
}: {
  onLogin: (emailOrUser: string | DemoUser, password?: string) => Promise<LoginResult> | void;
  isConfigured: boolean;
}) {
  const auth = useAuth() as unknown as { authError?: string } | null;
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState(auth?.authError ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth?.authError) setErr(auth.authError);
  }, [auth?.authError]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    if (!isConfigured) {
      const u = DEMO_USERS.find((d) => d.email === email && d.password === pass);
      if (u) onLogin(u);
      else setErr("Invalid email or password");
      setLoading(false);
      return;
    }
    const result = await onLogin(email, pass);
    if (result && result.error) setErr(result.error.message || "Invalid email or password");
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    if (!sbConfigured || !supabase) return;
    setLoading(true);
    setErr("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) { setErr(error.message); setLoading(false); }
  };

  return (
    <div className="bg-page-gradient flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card/80 p-8 shadow-xl backdrop-blur-sm">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="bg-brand-gradient mb-3 flex size-12 items-center justify-center rounded-xl text-white shadow-lg">
            <Building2Icon className="size-6" />
          </span>
          <div className="text-2xl font-bold tracking-tight">
            <span className="text-brand-gradient">{BRAND_NAME}</span>
          </div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Property Manager
          </div>
        </div>

        {!isConfigured && (
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangleIcon className="size-3.5 shrink-0" />
            Demo mode — connect Supabase for production
          </div>
        )}

        {isConfigured && (
          <>
            <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={handleGoogleLogin}>
              <GoogleIcon /> Continue with Google
            </Button>
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or sign in with email</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input id="login-email" type="email" autoComplete="email" placeholder="admin@propnest.app"
              value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-pass">Password</Label>
            <Input id="login-pass" type="password" autoComplete="current-password" placeholder="••••••••"
              value={pass} onChange={(e) => { setPass(e.target.value); setErr(""); }} />
          </div>
          {err && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</div>
          )}
          <Button type="submit" variant="gradient" className="mt-1 w-full" disabled={loading}>
            {loading ? <Loader2Icon className="animate-spin" /> : null}
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
          {isConfigured
            ? `Staff access only — use your ${BRAND_NAME} credentials`
            : "Demo: admin@propnest.app / admin1234"}
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default LoginScreen;
