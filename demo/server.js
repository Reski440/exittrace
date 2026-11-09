// ExitTrace demo target — intentionally imperfect, for local testing only.
// Demo credentials: demo / demo123. Never use these anywhere real.
// /dashboard sends no-store (correct). /profile sends public, max-age=3600
// (intentionally weak) so ExitTrace can demonstrate a real cache finding.
const express = require('express')
const app = express()
app.use(express.urlencoded({ extended: false }))
const parseCookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map((p) => { const [k, ...v] = p.trim().split('='); return [k, decodeURIComponent(v.join('='))] }).filter(([k]) => k))
const PORT = process.env.DEMO_PORT || 4001
const authed = (req) => parseCookies(req).et_demo === 'yes'
const loginPage = (msg = '') => `<!doctype html><html><head><meta charset="utf-8"><title>Demo — Login</title><style>body{font-family:system-ui;background:#0a0f14;color:#e6edf3;display:grid;place-items:center;min-height:100vh}form{background:#11181f;padding:32px;border-radius:12px}input{display:block;margin:8px 0;padding:10px;width:240px;background:#0a0f14;color:#fff;border:1px solid #26313b;border-radius:8px}button{padding:10px 18px;background:#2563eb;color:#fff;border:0;border-radius:8px}</style></head><body><form method="post" action="/login"><h1>Demo App — Login</h1>${msg ? `<p>${msg}</p>` : ''}<input name="username" placeholder="Username" autocomplete="username"><input name="password" type="password" placeholder="Password" autocomplete="current-password"><button type="submit">Log in</button><p>Demo: demo / demo123</p></form></body></html>`
app.get('/', (req, res) => res.send(loginPage()))
app.post('/login', (req, res) => {
  if (req.body.username === 'demo' && req.body.password === 'demo123') {
    res.cookie('et_demo', 'yes', { httpOnly: true, path: '/' })
    return res.redirect('/dashboard')
  }
  res.status(401).send(loginPage('Invalid demo credentials.'))
})
app.get('/dashboard', (req, res) => {
  if (!authed(req)) return res.redirect('/')
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Dashboard</title></head><body><h1>Dashboard SECRET-7F3A9</h1><p>Private dashboard content. <a href="/profile">Profile</a> · <a href="/logout">Log out</a></p></body></html>`)
})
app.get('/profile', (req, res) => {
  if (!authed(req)) return res.redirect('/')
  // Intentionally weak: a protected page that allows caching.
  res.set('Cache-Control', 'public, max-age=3600')
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Profile</title></head><body><h1>Profile SECRET-7F3A9</h1><p>Private profile content. <a href="/dashboard">Dashboard</a> · <a href="/logout">Log out</a></p></body></html>`)
})
app.get('/logout', (req, res) => { res.clearCookie('et_demo', { path: '/' }); res.redirect('/') })
app.get('/api/me', (req, res) => authed(req) ? res.json({ user: 'demo' }) : res.status(401).json({ error: 'unauthorized' }))
app.listen(PORT, () => console.log(`ExitTrace demo listening on http://localhost:${PORT}`))
