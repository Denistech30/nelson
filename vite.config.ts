import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'BrainBoard',
        short_name: 'BrainBoard',
        description: 'Student Result Management System',
        theme_color: '#1976d2',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    include: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/analytics']
  },
  build: {
    commonjsOptions: {
      include: [/firebase/]
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', '@mui/material', '@emotion/react', '@emotion/styled'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/analytics']
        }
      }
    }
  }
})