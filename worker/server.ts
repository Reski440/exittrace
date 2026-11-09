// Standalone Playwright worker. Run locally: `npm run worker`
// Dashboard (Vercel) talks to it via WORKER_URL + WORKER_TOKEN.
// The worker never stores credentials: they arrive per-request, in memory only.
import http from 'node:http'
import { runTest } from '../lib/engine'
import { saveRun } from '../lib/store'
import type { TestConfig } from '../lib/types'

const PORT = Number(process.env.WORKER_PORT || 4002)
const TOKEN = process.env.WORKER_TOKEN || ''

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  if (req.url === '/health' && req.method === 'GET') {
    res.end(JSON.stringify({ ok: true, engine: 'playwright', time: new Date().toISOString() }))
    return
  }
  if (req.url === '/run' && req.method === 'POST') {
    if (TOKEN && req.headers['x-worker-token'] !== TOKEN) { res.statusCode = 401; res.end(JSON.stringify({ error: 'unauthorized' })); return }
    let body = ''
    for await (const c of req) body += c
    try {
      const cfg = JSON.parse(body) as TestConfig
      const run = await runTest(cfg)
      saveRun(run)
      res.end(JSON.stringify(run))
    } catch (e) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
    }
    return
  }
  res.statusCode = 404
  res.end(JSON.stringify({ error: 'not found' }))
})
server.listen(PORT, () => console.log(`ExitTrace worker listening on http://localhost:${PORT} (POST /run, GET /health)`))
