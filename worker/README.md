# ExitTrace worker

Standalone Playwright execution engine. The Vercel dashboard never runs
Playwright itself; it calls this worker.

```bash
npm install
npx playwright install chromium
WORKER_PORT=4002 WORKER_TOKEN=<long-random-token> WORKER_ALLOW_LOCAL_TARGETS=true npm run worker
```

Endpoints:

- `GET /health` — `{ ok: true, engine: 'playwright' }`
- `POST /run` — body is a TestConfig JSON (same shape as the dashboard's
  New Test form). Header `x-worker-token` must match `WORKER_TOKEN` when set.
  Returns the full TestRun JSON with `engine: 'worker'` and saves a local
  copy to `data/runs.json`. The dashboard also saves the run in its own
  store when it delegates to this worker, so worker runs appear in the
  dashboard history.

Deploy it anywhere a long-lived Node process with Chromium can run
(VPS, Fly.io, Railway). Then set `WORKER_URL` (and `WORKER_TOKEN`) on the
Vercel project. Credentials arrive per-request and are never stored.

## Local targets

Localhost / private targets are blocked by default. A client request
(`allowLocalTargets: true`) is ignored unless the worker operator sets
`WORKER_ALLOW_LOCAL_TARGETS=true` in the worker's environment. The
dashboard applies the same server-side gate (`ALLOW_LOCAL_TARGETS`)
before delegating, so the worker never needs to trust the caller.
