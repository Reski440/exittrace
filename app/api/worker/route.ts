import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export async function GET() {
  const base = process.env.WORKER_URL
  if (!base) return NextResponse.json({ ok: false, mode: 'local-or-unavailable', message: 'No WORKER_URL set. Local runs use the in-process Playwright engine; Vercel deployments need a worker.' })
  try {
    const r = await fetch(`${base.replace(/\/$/, '')}/health`, { cache: 'no-store' })
    return NextResponse.json({ ok: r.ok, mode: 'worker', status: r.status })
  } catch (e) { return NextResponse.json({ ok: false, mode: 'worker', error: e instanceof Error ? e.message : String(e) }, { status: 502 }) }
}
