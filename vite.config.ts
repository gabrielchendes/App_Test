import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
        devOptions: {
          enabled: false,
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          importScripts: ['/firebase-messaging-sw.js'],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,json}'],
          globIgnores: [
            '**/AdminPanel*.js',
            '**/CourseEditor*.js',
            '**/PackageEditor*.js',
            '**/AiCourse*.js',
            '**/vendor-player*.js',
            '**/vendor-charts*.js',
            '**/vendor-quill*.js',
            '**/vendor-firebase*.js',
            '**/browser-image-compression*.js'
          ],
          maximumFileSizeToCacheInBytes: 4000000,
          runtimeCaching: [
            {
              // Imagens e arquivos do Supabase Storage.
              // NÃO inclui vídeo/áudio: o Safari exige respostas 206 (Range) reais do servidor,
              // e o cache do Workbox não consegue montá-las a partir de respostas opacas.
              urlPattern: ({ url, request }) =>
                /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/.test(url.href) &&
                request.destination !== 'video' &&
                request.destination !== 'audio' &&
                !/\.(mp4|webm|mov|m4v|mp3|m4a|ogg|wav|m3u8|ts)$/i.test(url.pathname),
              handler: 'CacheFirst',
              options: {
                cacheName: 'supabase-storage',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // REMOVIDO: regra do Cloudflare R2 (r2.dev) com CacheFirst + rangeRequests.
            // Ela causava o erro 416 no Safari. Sem regra, o Service Worker não intercepta
            // os vídeos do R2 e o navegador fala direto com o servidor.
            {
              urlPattern: /^https:\/\/images\.unsplash\.com\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'external-images',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 15, // 15 days
                }
              }
            }
          ]
        },
        manifest: {
          id: '/',
          name: 'Missing Trigger',
          short_name: 'Missing Trigger',
          description: 'Exclusive members area with premium content.',
          theme_color: '#0b0c10',
          background_color: '#0b0c10',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      })
    ],
    build: {
      target: 'esnext',
      minify: 'esbuild',
      cssMinify: true,
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react-quill-new') || id.includes('quill')) {
                return 'vendor-quill';
              }
              if (id.includes('react-player') || id.includes('hls.js') || id.includes('dashjs')) {
                return 'vendor-player';
              }
              if (id.includes('recharts')) {
                return 'vendor-charts';
              }
              if (id.includes('firebase') || id.includes('@firebase')) {
                return 'vendor-firebase';
              }
              if (id.includes('motion')) {
                return 'vendor-motion';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-lucide';
              }
              if (id.includes('@supabase')) {
                return 'vendor-supabase';
              }
              if (
                id.includes('/node_modules/react/') ||
                id.includes('/node_modules/react-dom/') ||
                id.includes('/node_modules/scheduler/')
              ) {
                return 'vendor-react';
              }
            }
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'react': path.resolve(__dirname, './node_modules/react'),
        'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'motion/react'
      ],
    },
    server: {
      hmr: false,
      watch: null,
    },
  };
});