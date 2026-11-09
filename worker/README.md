# ExitTrace worker

Standalone Playwright execution engine. The Vercel dashboard never runs
Playwright itself; it calls this worker.

```bash
npm install
npx playwright install chromium
WORKER_PORT=4002 WORKER_TOKEN=<long-random-token> npm run worker
```

Endpoints:

- `GET /health` — `{ ok: true, engine: 'playwright' }`
- `POST /run` — body is a TestConfig JSON (same shape as the dashboard's
  New Test form). Header `x-worker-token` must match `WORKER_TOKEN` when set.
  Returns the full TestRun JSON and saves it to `data/runs.json`.

Deploy it anywhere a long-lived Node process with Chromium can run
(VPS, Fly.io, Railway). Then set `WORKER_URL` (and `WORKER_TOKEN`) on the
Vercel project. Credentials arrive per-request and are never stored.
