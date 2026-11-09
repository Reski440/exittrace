import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { analyze } from './analysis'
import { validateTargetUrl, effectiveAllowLocalTargets } from './ssrf'
import type { HttpDetail, TestConfig, TestRun, TestStep } from './types'

const MARKER_FALLBACKS = ['SECRET', 'DASHBOARD', 'PROFILE', 'Welcome', 'protected']

export async function runTest(cfg: TestConfig): Promise<TestRun> {
  const started = Date.now()
  const id = randomUUID()
  const steps: TestStep[] = []
  const httpDetails: HttpDetail[] = []
  const consoleErrors: string[] = []
  const t0 = Date.now()
  const step = async (label: string, fn: () => Promise<{ status: TestStep['status']; detail: string; evidence?: string }>) => {
    const s = Date.now()
    try {
      const r = await fn()
      steps.push({ id: label, label, status: r.status, detail: r.detail, durationMs: Date.now() - s, evidence: r.evidence })
      return r
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      steps.push({ id: label, label, status: 'failed', detail: msg, durationMs: Date.now() - s })
      return { status: 'failed' as const, detail: msg }
    }
  }

  // Validate every URL up front (SSRF guard). Credentials are never logged.
  // The client flag is only honoured when the server operator enabled
  // local targets (ALLOW_LOCAL_TARGETS / WORKER_ALLOW_LOCAL_TARGETS).
  const allowLocal = effectiveAllowLocalTargets(!!cfg.allowLocalTargets)
  for (const [key, raw] of [['target', cfg.targetUrl], ['login', cfg.loginUrl], ['protected', cfg.protectedUrl], ['logout', cfg.logoutUrl]] as const) {
    const v = await validateTargetUrl(raw, allowLocal)
    if (!v.ok) {
      return failRun(id, cfg, started, steps, httpDetails, consoleErrors, `URL validation failed for ${key}: ${v.error}`)
    }
  }

  // Dynamic import so Vercel builds never load Playwright at build time.
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const marker = cfg.protectedMarker ?? 'SECRET'
  let afterLogoutStatus: number | null = null
  let afterLogoutBodyHasMarker = false
  let afterLogoutBodyHasLoginForm = false
  let serverStillServesAfterLogout: boolean | undefined
  let serverCheckStatus: number | null = null
  let backNavUrl = ''
  let backNavBodyHasMarker = false
  let backNavMadeNewProtectedRequest = false
  let reloadAfterLogoutStatus: number | null = null
  let reloadBodyHasMarker = false
  let screenshotPath: string | null = null

  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 500)) })
    page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 500)))
    let protectedRequestCount = 0
    page.on('response', (res) => {
      const url = res.url()
      if (url === cfg.protectedUrl || url.startsWith(cfg.protectedUrl)) protectedRequestCount++
      const cc = res.headers()['cache-control'] ?? null
      if (!httpDetails.some((h) => h.url === url && h.status === res.status())) {
        httpDetails.push({ url, status: res.status(), cacheControl: cc, method: res.request().method() })
      }
    })

    await step('Open login page', async () => {
      await page.goto(cfg.loginUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
      return { status: 'passed', detail: `Loaded ${cfg.loginUrl} (HTTP ${await page.evaluate(() => document.readyState)})` }
    })

    await step('Authenticate', async () => {
      await page.fill(cfg.usernameSelector, cfg.username, { timeout: 10000 })
      await page.fill(cfg.passwordSelector, cfg.password ?? '', { timeout: 10000 })
      await Promise.all([page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => undefined), page.click(cfg.submitSelector, { timeout: 10000 })])
      await page.waitForTimeout(800)
      return { status: 'passed', detail: `Submitted login form; now at ${page.url()}` }
    })

    await step('Open protected page while authenticated', async () => {
      await page.goto(cfg.protectedUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
      const body = await page.content()
      const ok = body.includes(marker) || MARKER_FALLBACKS.some((m) => body.includes(m))
      return ok
        ? { status: 'passed', detail: `Protected page loaded while authenticated (${page.url()})` }
        : { status: 'failed', detail: `Protected page loaded but the expected marker was not found at ${page.url()} — check selectors / credentials` }
    })

    await step('Log out', async () => {
      if (cfg.customLogoutSelector) {
        await page.click(cfg.customLogoutSelector, { timeout: 10000 }).catch(() => undefined)
        await page.waitForTimeout(600)
      }
      await page.goto(cfg.logoutUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(500)
      return { status: 'passed', detail: `Visited logout URL; now at ${page.url()}` }
    })

    const beforeBackCount = protectedRequestCount
    await step('Revisit protected page after logout (direct)', async () => {
      const res = await page.goto(cfg.protectedUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
      afterLogoutStatus = res?.status() ?? null
      const body = await page.content()
      afterLogoutBodyHasMarker = body.includes(marker)
      afterLogoutBodyHasLoginForm = /<form[^>]*>/i.test(body) && /password/i.test(body)
      // Distinguish cache-served from server-served: a no-store fetch bypasses
      // the HTTP cache and asks the server again with the same (logged-out) cookies.
      try {
        const check = await page.evaluate(async ({ url, marker }: { url: string; marker: string }) => {
          const r = await fetch(url, { cache: 'no-store', credentials: 'include', redirect: 'manual' })
          const t = await r.text()
          return { status: r.status, hasMarker: t.includes(marker) }
        }, { url: cfg.protectedUrl, marker })
        serverCheckStatus = check.status
        serverStillServesAfterLogout = check.status === 200 && check.hasMarker
      } catch { /* keep undefined — analysis falls back to High */ }
      const blocked = afterLogoutStatus === 302 || afterLogoutStatus === 401 || afterLogoutStatus === 403 || afterLogoutBodyHasLoginForm || !afterLogoutBodyHasMarker
      return blocked
        ? { status: 'passed', detail: `Direct revisit after logout: HTTP ${afterLogoutStatus}, marker present: ${afterLogoutBodyHasMarker}, login form shown: ${afterLogoutBodyHasLoginForm}` }
        : { status: 'failed', detail: `Direct revisit after logout still showed protected content (HTTP ${afterLogoutStatus}); server no-store re-check: HTTP ${serverCheckStatus}, still serves: ${serverStillServesAfterLogout}`, evidence: `GET ${cfg.protectedUrl} -> ${afterLogoutStatus}` }
    })

    await step('Back navigation after logout', async () => {
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => undefined)
      await page.waitForTimeout(600)
      backNavUrl = page.url()
      const body = await page.content()
      backNavBodyHasMarker = body.includes(marker)
      backNavMadeNewProtectedRequest = protectedRequestCount > beforeBackCount
      return {
        status: backNavBodyHasMarker && !backNavMadeNewProtectedRequest ? 'failed' : 'passed',
        detail: `Back landed on ${backNavUrl}; marker visible: ${backNavBodyHasMarker}; new protected request made: ${backNavMadeNewProtectedRequest}`,
      }
    })

    await step('Forward navigation after logout', async () => {
      await page.goForward({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => undefined)
      await page.waitForTimeout(500)
      return { status: 'info', detail: `Forward landed on ${page.url()}` }
    })

    await step('Reload protected page after logout', async () => {
      const res = await page.goto(cfg.protectedUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
      reloadAfterLogoutStatus = res?.status() ?? null
      const body = await page.content()
      reloadBodyHasMarker = body.includes(marker)
      const blocked = reloadAfterLogoutStatus !== 200 || !reloadBodyHasMarker
      return blocked
        ? { status: 'passed', detail: `Reload after logout: HTTP ${reloadAfterLogoutStatus}, marker present: ${reloadBodyHasMarker}` }
        : { status: 'failed', detail: `Reload after logout still returned HTTP ${reloadAfterLogoutStatus} with protected content visible` }
    })

    await step('Capture evidence screenshot', async () => {
      const dir = path.join(process.cwd(), 'data', 'screenshots')
      fs.mkdirSync(dir, { recursive: true })
      const p = path.join(dir, `${id}.png`)
      await page.screenshot({ path: p, fullPage: false })
      screenshotPath = `data/screenshots/${id}.png`
      return { status: 'passed', detail: 'Screenshot captured (retained only for this run; delete after review if it shows sensitive content)' }
    })

    await context.close()
  } finally {
    await browser.close()
  }

  const findings = analyze({
    protectedUrl: cfg.protectedUrl,
    httpDetails,
    afterLogoutStatus,
    afterLogoutBodyHasMarker,
    afterLogoutBodyHasLoginForm,
    serverStillServesAfterLogout,
    serverCheckStatus,
    backNavUrl,
    backNavBodyHasMarker,
    backNavMadeNewProtectedRequest,
    reloadAfterLogoutStatus,
    reloadBodyHasMarker,
    consoleErrors,
  })
  const failed = steps.some((s) => s.status === 'failed')
  const criticalHigh = findings.some((f) => f.severity === 'Critical' || f.severity === 'High')
  return {
    id, name: cfg.name, targetUrl: cfg.targetUrl, protectedUrl: cfg.protectedUrl,
    createdAt: new Date(started).toISOString(), durationMs: Date.now() - t0,
    status: failed || criticalHigh ? 'failed' : 'passed',
    steps, findings, httpDetails, consoleErrors, screenshotPath,
    engine: 'local-playwright',
    notes: 'Credentials were session-only and were not stored with this run.',
  }
}

function failRun(id: string, cfg: TestConfig, started: number, steps: TestStep[], httpDetails: HttpDetail[], consoleErrors: string[], error: string): TestRun {
  return {
    id, name: cfg.name, targetUrl: cfg.targetUrl, protectedUrl: cfg.protectedUrl,
    createdAt: new Date(started).toISOString(), durationMs: Date.now() - started,
    status: 'error', steps: [...steps, { id: 'validation', label: 'Validate target', status: 'failed', detail: error, durationMs: 0 }],
    findings: [{ id: 'F-0', severity: 'High', title: 'Test could not run', detail: error, evidence: error, recommendation: 'Fix the target configuration and re-run.' }],
    httpDetails, consoleErrors, screenshotPath: null, engine: 'unavailable',
  }
}
