import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import dotenv from 'dotenv'
import path from 'path'

// Load env vars at startup (for API handlers running in vite dev server)
dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback to .env

// Custom plugin to serve API routes locally in dev mode
const apiFallback = () => ({
  name: 'api-fallback',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url.startsWith('/api/')) {
        try {
          dotenv.config({ path: '.env.local' });
          dotenv.config();

          const handlerPath = path.resolve('.' + req.url.split('?')[0] + '.js');
          const { default: handler } = await import(`file://${handlerPath}?update=${Date.now()}`);
          
          let body = '';
          req.on('data', chunk => { body += chunk.toString(); });
          req.on('end', async () => {
            if (body) {
              try { req.body = JSON.parse(body); } catch(e) {}
            }
            
            res.status = (code) => { res.statusCode = code; return res; };
            res.json = (data) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            };
            
            await handler(req, res);
          });
          return;
        } catch (err) {
          console.error('API Error:', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
          return;
        }
      }
      next();
    });
  }
});

export default defineConfig({
  plugins: [
    apiFallback(),
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Mount Kenya Water Distributors',
        short_name: 'MK Water',
        description: 'Mount Kenya Water Distributors Fleet Management System',
        theme_color: '#059669',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Cache all app shell assets
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Network-first for Supabase API (always try fresh data, fall back to cache)
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
})