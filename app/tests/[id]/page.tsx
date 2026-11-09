import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getRun } from '../../../lib/store'
export const dynamic = 'force-dynamic'
const sev = (s: string) => ({ Critical: 'text-red-400', High: 'text-orange-400', Medium: 'text-yellow-300', Low: 'text-sky-300', Informational: 'text-muted' }[s] ?? '')
export default function TestDetails({ params }: { params: { id: string } }) {
  const run = getRun(params.id)
  if (!run) notFound()
  return (
    <div>
      <Link href="/history" className="text-sm text-muted hover:text-white">← History</Link>
      <h1 className="mt-2 text-2xl font-bold">{run.name}</h1>
      <p className="text-sm text-muted">{new Date(run.createdAt).toLocaleString()} · {run.status} · {run.durationMs} ms · Engine: {run.engine}</p>
      <div className="mt-4 flex gap-3">
        <a href={`/api/tests/${run.id}/export?format=json`} className="rounded-lg border border-line px-4 py-2 text-sm">Export JSON</a>
        <a href={`/api/tests/${run.id}/export?format=html`} className="rounded-lg border border-line px-4 py-2 text-sm">Export HTML</a>
      </div>
      <h2 className="mt-8 text-lg font-semibold">Steps</h2>
      <ol className="mt-2 space-y-2">{run.steps.map((s) => <li key={s.id} className="rounded-lg border border-line bg-panel p-3 text-sm"><strong>{s.label}</strong> — {s.status}<br /><span className="text-muted">{s.detail}</span></li>)}</ol>
      <h2 className="mt-8 text-lg font-semibold">Findings ({run.findings.length})</h2>
      <ul className="mt-2 space-y-3">{run.findings.map((f) => (
        <li key={f.id} className="rounded-xl border border-line bg-panel p-4">
          <p className={`font-medium ${sev(f.severity)}`}>{f.severity} — {f.title}</p>
          <p className="mt-1 text-sm">{f.detail}</p>
          <p className="mt-1 text-xs text-muted">Evidence: {f.evidence}</p>
          <p className="mt-1 text-sm">Recommendation: {f.recommendation}</p>
        </li>
      ))}</ul>
      <h2 className="mt-8 text-lg font-semibold">HTTP details</h2>
      <ul className="mt-2 space-y-1 text-sm">{run.httpDetails.map((h, i) => <li key={i} className="text-muted">{h.method} {h.url} → {h.status} — Cache-Control: {h.cacheControl ?? '(missing)'}</li>)}</ul>
      {run.consoleErrors.length > 0 && (<><h2 className="mt-8 text-lg font-semibold">Console errors</h2><ul className="mt-2 space-y-1 text-sm text-muted">{run.consoleErrors.map((e, i) => <li key={i}>{e}</li>)}</ul></>)}
      {run.notes && <p className="mt-6 text-xs text-muted">{run.notes}</p>}
    </div>
  )
}
