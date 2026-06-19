import { defineConfig } from 'vitest/config';

// Static single-page build (D-03): `vite build` emits a self-contained dist/.
// Vitest config lives here too so the engine and its specs share one toolchain.
export default defineConfig({
  base: './',
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
