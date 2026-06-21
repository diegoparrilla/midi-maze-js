import { defineConfig } from 'vitest/config';

// Static single-page build (D-03): `vite build` emits a self-contained dist/.
// Vitest config lives here too so the engine and its specs share one toolchain.
export default defineConfig({
  base: './',
  // Listen on all interfaces so phones/tablets on the same LAN can reach the dev
  // server (needed to test touch controls on real devices). Vite prints the
  // Network: http://<lan-ip>:5173 URL on start.
  server: {
    host: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
});
