import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MoonIcon, SunIcon } from "lucide-react";

const KEY = "propnest:theme";

function readInitial(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [mode, setMode] = useState<"light" | "dark">(() => readInitial());

  useEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
    try { window.localStorage.setItem(KEY, mode); } catch { /* ignore */ }
  }, [mode]);

  return (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}
      onClick={() => setMode((m) => (m === "dark" ? "light" : "dark"))}
    >
      {mode === "dark" ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
