import http from 'http'
import next from 'next'
import { parse } from 'url'
import { initSocketServer } from './backend/socket'
import { createExpressApp } from './backend/app'

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)
const app = next({ dev })
const handle = app.getRequestHandler()

async function startServer() {
  try {
    await app.prepare()
    const expressApp = createExpressApp()
    const server = http.createServer(expressApp)

    // 1. Initialize Socket.IO on the unified HTTP server
    initSocketServer(server)

    // 2. Delegate all unhandled requests to Next.js (pages, static assets, etc.)
    expressApp.all(/.*/, (req, res) => {
      const parsedUrl = parse(req.url || '/', true)
      handle(req, res, parsedUrl)
    })

    server.listen(port, '0.0.0.0', () => {
      console.log(`> Kisan-Mitra unified server ready on http://0.0.0.0:${port} [env: ${dev ? 'development' : 'production'}]`)
    })
  } catch (err) {
    console.error('Failed to start Kisan-Mitra unified server:', err)
    process.exit(1)
  }
}

startServer()
