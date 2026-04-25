import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Sobrius — Контроль алкоголю',
        short_name: 'Sobrius',
        description:
          'Розрахунок рівня алкоголю в крові, статистика за день/місяць/рік та прогноз, коли можна за кермо.',
        theme_color: '#fbf7f0',
        background_color: '#fbf7f0',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'uk',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png',     sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png',     sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable.png',sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      }
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
