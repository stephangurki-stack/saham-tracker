import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * `vite dev` doesn't serve /api routes (that's Vercel's job in production).
 * This plugin emulates the Edge Functions locally during `npm run dev`, by
 * adapting Vite's Connect middleware req/res to the Web Request/Response
 * signature each handler under api/*.ts exports, routed by path segment
 * (/api/prices -> api/prices.ts, /api/fundamentals -> api/fundamentals.ts).
 */
function apiDevMiddleware(env: Record<string, string>): Plugin {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()

        process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL
        process.env.VITE_SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY

        const routeName = req.url.split('?')[0].replace('/api/', '')
        const mod = await server.ssrLoadModule(`/api/${routeName}.ts`)
        const webReq = new Request(`http://localhost${req.url}`, { method: req.method })
        const webRes: Response = await mod.default(webReq)
        res.statusCode = webRes.status
        webRes.headers.forEach((value, key) => res.setHeader(key, value))
        res.end(await webRes.text())
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      tailwindcss(),
      apiDevMiddleware(env),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico'],
        manifest: {
          name: 'Portfolio Tracker Saham IDX',
          short_name: 'Porto IDX',
          description: 'Pelacak portofolio saham IDX pribadi',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          ],
        },
      }),
    ],
  }
})
