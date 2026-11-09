import { NextResponse } from 'next/server'
import { listRuns, saveRun } from '../../../lib/store'
import { validateTargetUrl } from '../../../lib/ssrf'
import type { TestConfig } from '../../../lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET() {
  return NextResponse.json(listRuns())
}

export async function POST(req: Request) {
  const cfg = (await req.json()) as TestConfig
  if (!cfg.targetUrl || !cfg.loginUrl || !cfg.protectedUrl || !cfg.logoutUrl) {
    return NextResponse.json({ error: 'targetUrl, loginUrl, protectedUrl and logoutUrl are required' }, { status: 400 })
  }
  const v = await validateTargetUrl(cfg.targetUrl, !!cfg.allowLocalTargets)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  // If a separate worker is configured, delegate to it. Otherwise run locally.
  // On Vercel (no local Playwright), WORKER_URL must be set — otherwise fail honestly.
  const workerUrl = process.env.WORKER_URL
  if (workerUrl) {
    const res = await fetch(`${workerUrl.replace(/\/$/, '')}/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.WORKER_TOKEN ? { 'x-worker-token': process.env.WORKER_TOKEN } : {}) },
      body: JSON.stringify(cfg),
    })
    if (!res.ok) return NextResponse.json({ error: `Worker failed (HTTP ${res.status})` }, { status: 502 })
    const run = await res.json()
    return NextResponse.json(run)
  }
  if (process.env.VERCEL) {
    return NextResponse.json({ error: 'Playwright engine is unavailable on this deployment. Run ExitTrace locally (npm run dev) or connect a worker via WORKER_URL — see Settings.' }, { status: 503 })
  }
  const { runTest } = await import('../../../lib/engine')
  const run = await runTest(cfg)
  saveRun(run)
  return NextResponse.json(run)
}
