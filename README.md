# ExitTrace — Browser Logout Security Tester

ExitTrace is an automated browser security testing tool. It checks whether a web
application properly clears access to private pages after a user logs out —
through direct revisits, browser Back/Forward, reloads, BFCache restores, and
cache headers.

**Only test applications you own or are explicitly authorised to test.**

## What it does

- **Test configuration** — target URL, login URL, protected page URL, logout
  URL, login form selectors, credentials (session-only, never stored), optional
  custom logout action.
- **Browser test engine (Playwright)** — logs in with real Chromium, opens the
  protected page, logs out, then re-checks it directly, via Back/Forward, and
  on reload. It distinguishes a visual BFCache restore from a page that still
  fetches protected data and from a page that is correctly blocked.
- **Security analysis** — Cache-Control headers, post-logout accessibility,
  BFCache behaviour, auth state. Severities: Critical / High / Medium / Low /
  Informational. Critical/High are only assigned with concrete evidence
  (a 200 response containing protected content after logout).
- **Reports** — status, failed steps, findings with evidence and
  recommendations, HTTP details, console errors, screenshots. Export JSON/HTML.
- **Dashboard** — total / passed / failed tests, findings, recent activity.
  All numbers come from real runs stored in `data/runs.json`. No fake stats.

## Architecture

```
Vercel (dashboard + UI) ── WORKER_URL ──► Node.js worker (Playwright)
        │                                        │
        └─ local dev: in-process Playwright ──────┘
```

Playwright does **not** run in a Vercel serverless function. Two modes:

1. **Local execution (works now):** `npm run dev` runs the engine in-process.
   `POST /api/tests` runs Playwright directly. This is the default.
2. **Separate worker:** run `npm run worker` (port 4002, `POST /run`,
   `GET /health`, optional `WORKER_TOKEN`), set `WORKER_URL` on the Vercel
   project, and the dashboard delegates test runs to it. The worker never
   stores credentials — they arrive per-request, in memory only.

If neither is available, the dashboard says so honestly (HTTP 503 with an
explanation) instead of pretending a test ran.

## Run locally

```bash
npm install
npx playwright install chromium
# Terminal 1 — demo target (login demo / demo123)
npm run demo
# Terminal 2 — dashboard
npm run dev
# Terminal 3 — run the real demo test
npm run test:demo
```

Then open http://localhost:3000 — the demo run appears on the Dashboard.

### Run the worker separately

```bash
WORKER_PORT=4002 WORKER_TOKEN=choose-a-long-random-token npm run worker
# In the dashboard env:
WORKER_URL=http://localhost:4002
WORKER_TOKEN=choose-a-long-random-token
```

## Demo app

`demo/server.js` is a small Express app (port 4001) with a login page and two
protected pages. `/dashboard` sends `Cache-Control: no-store` (correct);
`/profile` sends `Cache-Control: public, max-age=3600` (intentionally weak)
so a real run demonstrates a cache finding. Demo credentials are
`demo` / `demo123` — demo only.

## Security

- Credentials are session-only: the API strips them before a run is saved,
  they are never written to logs, files, or analytics.
- Target URLs are validated; SSRF is blocked (non-http(s), embedded
  credentials, private/loopback hosts and DNS-rebinding to private addresses
  are rejected unless local testing mode is explicitly enabled).
- No destructive actions. Screenshots are kept only under `data/screenshots/`
  for the run that produced them; delete them after review if they show
  sensitive content.
- Test runs are stored as a local JSON file (`data/runs.json`) — a suitable
  local store for local execution. It is git-ignored; the committed sample
  in `data/runs.sample.json` is a real run against the demo app, labelled as
  such, so the deployed dashboard shows real (not invented) results.

## Deploy

1. Push to GitHub (`Reski440/exittrace`).
2. In Vercel, create a project from that repo (framework: Next.js).
3. For live tests from the deployed dashboard, deploy the worker somewhere
   reachable (a small VPS / Fly.io / Railway Node service running
   `npm run worker` with Playwright + Chromium) and set `WORKER_URL` and
   `WORKER_TOKEN` on the Vercel project.

## Known limitations

- The Vercel deployment is the dashboard only; it cannot run Playwright
  itself. Live tests from Vercel require the separate worker.
- BFCache detection is behavioural (marker visible without a new protected
  request); Chromium's BFCache eligibility depends on headers and page
  behaviour, so a “no BFCache restore observed” result is evidence for that
  run, not a proof for all browsers.
- The demo target is deliberately simple; real apps may need custom login
  flows (SSO, MFA, captchas) that ExitTrace does not automate.
