import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { proxyApiPlugin } from './vite/proxy-plugin'

const root = import.meta.dirname ?? process.cwd()

export default defineConfig({
  plugins: [react(), proxyApiPlugin()],
  server: {
    headers: { 'X-Robots-Tag': 'noindex, nofollow' },
  },
  resolve: {
    alias: {
      '@': `${root}/src`,
    },
  },
  build: {
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
})
