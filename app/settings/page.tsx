import { serverAllowsLocalTargets } from '../../lib/ssrf'
import { storageInfo } from '../../lib/store'

export const dynamic = 'force-dynamic'
export default async function Settings() {
  let worker: { ok: boolean; error?: string } = { ok: false, error: 'WORKER_URL is not set' }
  try {
    const base = process.env.WORKER_URL
    if (base) {
      const r = await fetch(`${base.replace(/\/$/, '')}/health`, { cache: 'no-store' })
      worker = { ok: r.ok }
    }
  } catch (e) { worker = { ok: false, error: e instanceof Error ? e.message : String(e) } }
  const storage = storageInfo()
  const allowLocal = serverAllowsLocalTargets()
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <section className="mt-6 rounded-xl border border-line bg-panel p-4">
        <h2 className="font-semibold">Playwright worker</h2>
        <p className="mt-1 text-sm text-muted">Playwright does not run inside a Vercel serverless function. Run tests locally (the dashboard runs the engine directly when you run it with <code>npm run dev</code>), or point the dashboard at a separate worker with the <code>WORKER_URL</code> environment variable.</p>
        <p className="mt-3 text-sm">Worker status: <strong>{worker.ok ? 'Reachable' : 'Not reachable'}</strong>{worker.error ? ` — ${worker.error}` : ''}</p>
        <p className="mt-2 text-sm text-muted">Local worker: <code>npm run worker</code> (port 4002), then set <code>WORKER_URL=http://localhost:4002</code> and <code>WORKER_TOKEN</code> to match. See README and worker/README.</p>
      </section>
      <section className="mt-4 rounded-xl border border-line bg-panel p-4">
        <h2 className="font-semibold">Test history storage</h2>
        <p className="mt-1 text-sm">Storage: <strong>{storage.backend === 'kv' ? 'Vercel KV (persistent)' : 'Local JSON file'}</strong></p>
        <p className="mt-1 text-sm text-muted">{storage.note}</p>
        {!storage.persistent && <p className="mt-2 text-sm text-muted">To make history permanent on Vercel: Vercel dashboard → Storage → Create Database → KV, then link it to the exittrace project (this sets KV_REST_API_URL and KV_REST_API_TOKEN automatically) and redeploy. See README.</p>}
      </section>
      <section className="mt-4 rounded-xl border border-line bg-panel p-4">
        <h2 className="font-semibold">Safety</h2>
        <p className="mt-1 text-sm text-muted">Test only applications you own or are explicitly authorised to test. Localhost / private targets are {allowLocal ? 'enabled on this server (ALLOW_LOCAL_TARGETS=true)' : 'blocked on this server'} — the “Allow localhost” checkbox alone never enables them; the server operator must set ALLOW_LOCAL_TARGETS=true (dashboard) or WORKER_ALLOW_LOCAL_TARGETS=true (worker). Credentials are session-only and are never stored, logged, or sent anywhere else.</p>
      </section>
    </div>
  )
}
