import Link from 'next/link'
import { listRuns } from '../../lib/store'
export const dynamic = 'force-dynamic'
export default function History() {
  const runs = listRuns()
  return (
    <div>
      <h1 className="text-2xl font-bold">Test history</h1>
      {runs.length === 0 ? <p className="mt-3 text-sm text-muted">No tests yet.</p> : (
        <ul className="mt-4 space-y-3">{runs.map((r) => (
          <li key={r.id} className="rounded-xl border border-line bg-panel p-4">
            <Link href={`/tests/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
            <p className="text-xs text-muted">{new Date(r.createdAt).toLocaleString()} · {r.status} · {r.findings.length} finding(s)</p>
          </li>
        ))}</ul>
      )}
    </div>
  )
}
