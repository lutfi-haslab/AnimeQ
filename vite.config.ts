import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { proxyApiPlugin } from './vite/proxy-plugin'

const root = import.meta.dirname ?? process.cwd()

export default defineConfig({
  plugins: [react(), proxyApiPlugin()],
  resolve: {
    alias: {
      '@': `${root}/src`,
    },
  },
  // Build output goes into the Pytauri frontend dir so the bundled Python
  // server + Tauri webview can serve it.
  build: {
    outDir: 'python/src/animeq/frontend',
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          icons: ['@tabler/icons-react'],
        },
      },
    },
  },
  // Dev server for the Pytauri dev launcher. Bind explicitly to IPv4 so the
  // webview's `http://127.0.0.1:1420` resolves (`localhost` may bind IPv6 only).
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/python/**', '**/.venv/**'] },
  },
})
