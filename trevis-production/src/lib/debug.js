/**
 * debug — gated console logging (TD-13).
 *
 * Verbose console.log/time instrumentation was left throughout the app (some of
 * it leaking user emails/roles into the production console). Route all of it
 * through these helpers so it's silent in production and opt-in for development.
 *
 * Enabled when:
 *   - running the dev server (import.meta.env.DEV), OR
 *   - localStorage.propnest_debug === '1'  (toggle in any browser without a rebuild)
 *
 * console.error / console.warn are NOT gated — real failures must always surface.
 *
 * @module debug
 */

function debugEnabled() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) return true;
  } catch { /* import.meta not available (e.g. node script) */ }
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('propnest_debug') === '1') return true;
  } catch { /* no localStorage (SSR/node) */ }
  return false;
}

export const debug = (...args) => { if (debugEnabled()) console.log(...args); };
export const debugTime = (label) => { if (debugEnabled()) console.time(label); };
export const debugTimeEnd = (label) => { if (debugEnabled()) console.timeEnd(label); };
