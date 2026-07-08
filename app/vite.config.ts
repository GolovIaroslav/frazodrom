/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// Serves the repo-root packs/ dir under /packs/* — both in dev (middleware)
// and in the production build (static copy into dist/packs). Packs live
// outside app/ (PLAN.md §5.1) so they are not duplicated into app source.
function packsDevMiddleware() {
  return {
    name: 'packs-dev-middleware',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/packs', (req, res, next) => {
        import('node:path').then(async (path) => {
          const fs = await import('node:fs')
          const filePath = path.resolve(__dirname, '../packs', `.${req.url ?? ''}`)
          if (!filePath.startsWith(path.resolve(__dirname, '../packs'))) {
            res.statusCode = 403
            res.end()
            return
          }
          fs.readFile(filePath, (err, data) => {
            if (err) {
              next()
              return
            }
            res.setHeader('Content-Type', 'application/json')
            res.end(data)
          })
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    packsDevMiddleware(),
    viteStaticCopy({
      // `../packs` resolves relative to the source path, and dirClean strips
      // the leading `../`, so `dest: '.'` (not 'packs') lands files at
      // dist/packs/*.json — passing 'packs' here would double the segment.
      targets: [{ src: '../packs/*.json', dest: '.' }],
    }),
  ],
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'http://localhost/' },
    },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
})
