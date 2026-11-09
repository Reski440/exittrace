import Link from 'next/link'
import { listRuns, dashboardStats } from '../lib/store'

export const dynamic = 'force-dynamic'

const sevColor: Record<string, string> = { Critical: 'text-red-400', High: 'text-orange-400', Medium: 'text-yellow-300', Low: 'text-sky-300', Informational: 'text-muted' }

export default function Dashboard() {
  const runs = listRuns()
  const s = dashboardStats(runs)
  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-1 text-sm text-muted">Real test results only. If no test has run yet, these numbers are zero — nothing is invented.</p>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        {[['Total tests', s.total], ['Passed', s.passed], ['Failed', s.failed], ['Findings', s.findings], ['Critical / High', s.criticalHigh]].map(([label, v]) => (
          <div key={label as string} className="rounded-xl border border-line bg-panel p-4"><div className="text-2xl font-bold">{v}</div><div className="text-xs text-muted">{label}</div></div>
        ))}
      </div>
      <div className="mt-6 flex gap-3">
        <Link href="/new" className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium">New security test</Link>
        <Link href="/history" className="rounded-lg border border-line px-4 py-2 text-sm">View history</Link>
      </div>
      <h2 className="mt-8 text-lg font-semibold">Recent test activity</h2>
      {runs.length === 0 ? (
        <p className="mt-2 rounded-xl border border-line bg-panel p-4 text-sm text-muted">No tests yet. Run your first test from New Test — locally with Playwright, or via a connected worker.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {runs.slice(0, 10).map((r) => (
            <li key={r.id} className="rounded-xl border border-line bg-panel p-4">
              <Link href={`/tests/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
              <p className="text-xs text-muted">{new Date(r.createdAt).toLocaleString()} · {r.status} · {r.findings.length} finding(s) · {r.engine}</p>
              <p className="mt-1 text-sm">{r.findings.map((f) => <span key={f.id} className={`mr-3 ${sevColor[f.severity]}`}>{f.severity}</span>)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
