import { NextResponse } from 'next/server'
import { listRuns, saveRun } from '../../../lib/store'
import { validateTargetUrl, effectiveAllowLocalTargets } from '../../../lib/ssrf'
import type { TestConfig, TestRun } from '../../../lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET() {
  return NextResponse.json(await listRuns())
}

export async function POST(req: Request) {
  const cfg = (await req.json()) as TestConfig
  if (!cfg.targetUrl || !cfg.loginUrl || !cfg.protectedUrl || !cfg.logoutUrl) {
    return NextResponse.json({ error: 'targetUrl, loginUrl, protectedUrl and logoutUrl are required' }, { status: 400 })
  }
  // Server-side SSRF gate: the client flag is only honoured when the
  // server operator enabled local targets (ALLOW_LOCAL_TARGETS=true).
  // Validate ALL four URLs before delegating anywhere.
  const allowLocal = effectiveAllowLocalTargets(!!cfg.allowLocalTargets)
  cfg.allowLocalTargets = allowLocal
  for (const [key, raw] of [['target', cfg.targetUrl], ['login', cfg.loginUrl], ['protected', cfg.protectedUrl], ['logout', cfg.logoutUrl]] as const) {
    const v = await validateTargetUrl(raw, allowLocal)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  }

  // If a separate worker is configured, delegate to it. Otherwise run locally.
  // On Vercel (no local Playwright), WORKER_URL must be set — otherwise fail honestly.
  const workerUrl = process.env.WORKER_URL
  if (workerUrl) {
    const res = await fetch(`${workerUrl.replace(/\/$/, '')}/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.WORKER_TOKEN ? { 'x-worker-token': process.env.WORKER_TOKEN } : {}) },
      body: JSON.stringify(cfg),
    })
    if (!res.ok) return NextResponse.json({ error: `Worker failed (HTTP ${res.status})` }, { status: 502 })
    const run = (await res.json()) as TestRun
    // Persist the worker run in the dashboard's own store so it appears
    // in history — the worker's local copy is not shared with Vercel.
    run.engine = 'worker'
    delete (run as unknown as Record<string, unknown>).password
    try { await saveRun(run) } catch (e) { console.error('Failed to save worker run:', e) }
    return NextResponse.json(run)
  }
  if (process.env.VERCEL) {
    return NextResponse.json({ error: 'Playwright engine is unavailable on this deployment. Run ExitTrace locally (npm run dev) or connect a worker via WORKER_URL — see Settings.' }, { status: 503 })
  }
  const { runTest } = await import('../../../lib/engine')
  const run = await runTest(cfg)
  await saveRun(run)
  return NextResponse.json(run)
}
