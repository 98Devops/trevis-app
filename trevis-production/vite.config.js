import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'node:child_process'

// Build stamp: which commit + when this bundle was built. Deploys are manual
// dist uploads, so without this nothing records what's actually live.
let gitSha = 'unknown'
try { gitSha = execSync('git rev-parse --short HEAD').toString().trim() } catch { /* no git */ }
const buildTime = new Date().toISOString().slice(0, 16).replace('T', ' ')

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __BUILD_SHA__: JSON.stringify(gitSha),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
})
