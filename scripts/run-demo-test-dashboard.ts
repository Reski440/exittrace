import { runTest } from '../lib/engine'
import { saveRun } from '../lib/store'
async function main() {
  const run = await runTest({
    name: 'Demo — localhost dashboard (no-store, should pass)',
    targetUrl: 'http://localhost:4001',
    loginUrl: 'http://localhost:4001/',
    protectedUrl: 'http://localhost:4001/dashboard',
    logoutUrl: 'http://localhost:4001/logout',
    usernameSelector: 'input[name="username"]',
    passwordSelector: 'input[name="password"]',
    submitSelector: 'button[type="submit"]',
    username: 'demo',
    password: 'demo123',
    allowLocalTargets: true,
    protectedMarker: 'SECRET-7F3A9',
  })
  saveRun(run)
  console.log(JSON.stringify({ id: run.id, status: run.status, findings: run.findings.map((f) => `${f.severity}: ${f.title}`) }, null, 2))
}
main().catch((e) => { console.error(e); process.exit(1) })
