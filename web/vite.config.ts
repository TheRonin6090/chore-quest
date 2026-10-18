import { defineConfig } from 'vite';

// The wall iPad runs iOS 12 Safari. See docs/DECISIONS.md.
export default defineConfig({
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  build: {
    target: 'safari12',
    cssTarget: 'safari12',
    modulePreload: { polyfill: false },
  },
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:8080',
      '/healthz': 'http://localhost:8080',
    },
  },
});
