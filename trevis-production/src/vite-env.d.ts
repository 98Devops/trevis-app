/// <reference types="vite/client" />

// Build stamp injected by vite.config.js `define` (git SHA + build time).
// `typeof __BUILD_SHA__ !== "undefined"` guards non-Vite contexts (vitest).
declare const __BUILD_SHA__: string;
declare const __BUILD_TIME__: string;
