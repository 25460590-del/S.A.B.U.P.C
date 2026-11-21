import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-bupc.png'],
      manifest: {
        name: 'S.A.B.U.P.C — BUPC UdeC',
        short_name: 'S.A.B.U.P.C',
        description:
          'Sistema de Asistencia, Credencial QR y Bitácora de Radio de la Brigada Universitaria de Protección Civil — Universidad de Colima.',
        theme_color: '#1E5631',
        background_color: '#0B120E',
        display: 'standalone',
        lang: 'es-MX',
        start_url: '/',
        icons: [
          {
            src: '/logo-bupc.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/logo-bupc.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
})
