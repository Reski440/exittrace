'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const initial = {
  name: 'Local test', targetUrl: 'http://localhost:4001', loginUrl: 'http://localhost:4001/',
  protectedUrl: 'http://localhost:4001/profile', logoutUrl: 'http://localhost:4001/logout',
  usernameSelector: 'input[name="username"]', passwordSelector: 'input[name="password"]',
  submitSelector: 'button[type="submit"]', username: 'demo', password: '',
  protectedMarker: 'SECRET-7F3A9', allowLocalTargets: true,
}

export default function NewTest() {
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/tests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Test failed to start')
      router.push(`/tests/${data.id}`)
    } catch (err) { setError(err instanceof Error ? err.message : String(err)) } finally { setBusy(false) }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">New security test</h1>
      <p className="mt-1 text-sm text-muted">Only test applications you own or are explicitly authorised to test. Credentials are sent for this run only and are never stored.</p>
      <form onSubmit={submit} className="mt-4">
        <label htmlFor="name">Test name</label><input id="name" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        <label htmlFor="targetUrl">Target application URL</label><input id="targetUrl" value={form.targetUrl} onChange={(e) => set('targetUrl', e.target.value)} required />
        <label htmlFor="loginUrl">Login URL</label><input id="loginUrl" value={form.loginUrl} onChange={(e) => set('loginUrl', e.target.value)} required />
        <label htmlFor="protectedUrl">Protected page URL</label><input id="protectedUrl" value={form.protectedUrl} onChange={(e) => set('protectedUrl', e.target.value)} required />
        <label htmlFor="logoutUrl">Logout URL</label><input id="logoutUrl" value={form.logoutUrl} onChange={(e) => set('logoutUrl', e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <div><label htmlFor="usernameSelector">Username selector</label><input id="usernameSelector" value={form.usernameSelector} onChange={(e) => set('usernameSelector', e.target.value)} required /></div>
          <div><label htmlFor="passwordSelector">Password selector</label><input id="passwordSelector" value={form.passwordSelector} onChange={(e) => set('passwordSelector', e.target.value)} required /></div>
        </div>
        <label htmlFor="submitSelector">Submit selector</label><input id="submitSelector" value={form.submitSelector} onChange={(e) => set('submitSelector', e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <div><label htmlFor="username">Username</label><input id="username" value={form.username} onChange={(e) => set('username', e.target.value)} required /></div>
          <div><label htmlFor="password">Password (session-only)</label><input id="password" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required autoComplete="off" /></div>
        </div>
        <label htmlFor="protectedMarker">Protected-page marker text</label><input id="protectedMarker" value={form.protectedMarker} onChange={(e) => set('protectedMarker', e.target.value)} />
        <label className="mt-4 flex items-center gap-2 text-sm normal-case"><input type="checkbox" checked={form.allowLocalTargets} onChange={(e) => set('allowLocalTargets', e.target.checked)} className="!w-auto" /> Allow localhost / private targets (controlled local testing mode only)</label>
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-900 bg-red-950 p-3 text-sm">{error}</p>}
        <button disabled={busy} className="mt-6 rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium disabled:opacity-50">{busy ? 'Running test — this takes about 20–40 seconds…' : 'Run test'}</button>
      </form>
    </div>
  )
}
