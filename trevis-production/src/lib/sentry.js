import * as Sentry from "@sentry/react";

let initialized = false;

/**
 * Initialize Sentry ONLY when a DSN is provided (VITE_SENTRY_DSN). Without it
 * this is a complete no-op — safe to ship today; error monitoring switches on the
 * moment you set the env var on the deploy (e.g. Trevis production), with nothing
 * to change in code. Keeps noise out of local dev too.
 *
 * `environment` is driven by VITE_SENTRY_ENVIRONMENT so a non-production build
 * (e.g. the public demo, VITE_SENTRY_ENVIRONMENT=demo) is tagged distinctly and
 * can NEVER be mistaken for a real production incident. Falls back to the Vite
 * build mode when unset (so Trevis production stays 'production').
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || initialized) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    tracesSampleRate: 0.1,
    // A payment system carries tenant PII — do not let Sentry attach it by default.
    sendDefaultPii: false,
  });
  initialized = true;
}

/** Report a caught error (e.g. from the React error boundary). No-op until init'd. */
export function reportError(error, context) {
  if (!initialized) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
