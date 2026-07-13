import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider, DataProvider } from './parts/p1_imports_context.jsx'
import PropNestShell from './components/propnest/propnest-shell'
import { Toaster } from './components/ui/sonner'
import { initSentry } from './lib/sentry.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { BRAND_NAME } from './lib/brand'

// No-op unless VITE_SENTRY_DSN is set (i.e. only on the live deploy).
initSentry()

// Brand the browser tab from the active deploy (PropNest vs Trevis) without
// editing static index.html.
document.title = `${BRAND_NAME} | Property Management`

// The new PropNest shell is the default UI and now has FULL feature parity with
// the original App: inline tenant edits, payment edit/delete, room rename/delete,
// add/remove beds, cross-property transfer, and the repair-coverage admin tool are
// all built. /?legacy=1 keeps the original App available only as a reference /
// emergency fallback.
const params = new URLSearchParams(window.location.search)
const showLegacy = params.has('legacy')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Top-level safety net: any crash in the providers or the shell shows the
        friendly fallback (not a white screen) and is forwarded to Sentry. The
        legacy App.jsx keeps its own per-screen boundaries; this protects the
        production PropNest shell, which had none. */}
    <ErrorBoundary componentName="Application">
      <AuthProvider>
        <DataProvider>
          {showLegacy ? <App /> : <PropNestShell />}
          <Toaster />
        </DataProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
