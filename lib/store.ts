import fs from 'node:fs'
import path from 'node:path'
import type { TestRun } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const RUNS_FILE = path.join(DATA_DIR, 'runs.json')
const SAMPLE_FILE = path.join(DATA_DIR, 'runs.sample.json')
const KV_KEY = 'exittrace:runs'
const MAX_RUNS = 200

export type StorageBackend = 'kv' | 'file'

/**
 * Which storage backend is active. Vercel KV is used only when its
 * credentials are present (Vercel auto-injects KV_REST_API_URL and
 * KV_REST_API_TOKEN when a KV database is linked to the project).
 * Otherwise the local JSON file is used.
 */
export function storageBackend(): StorageBackend {
  return process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN ? 'kv' : 'file'
}

/** True only when history is stored in a persistent backend. */
export function storageIsPersistent(): boolean {
  return storageBackend() === 'kv'
}

export function storageInfo(): { backend: StorageBackend; persistent: boolean; note: string } {
  if (storageBackend() === 'kv') {
    return { backend: 'kv', persistent: true, note: 'Test history is stored in Vercel KV and persists across deployments.' }
  }
  return {
    backend: 'file',
    persistent: false,
    note: 'Test history is stored in a local JSON file (data/runs.json). On Vercel serverless this does not persist — link a Vercel KV database to the project to make history permanent.',
  }
}

function ensureDir() { fs.mkdirSync(DATA_DIR, { recursive: true }) }

function sortRuns(runs: TestRun[]): TestRun[] {
  return [...runs].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
}

/** The committed demo runs (real runs against the demo app, labelled as such). */
function readSampleRuns(): TestRun[] {
  try {
    if (!fs.existsSync(SAMPLE_FILE)) return []
    const raw = JSON.parse(fs.readFileSync(SAMPLE_FILE, 'utf8')) as TestRun[]
    return Array.isArray(raw) ? sortRuns(raw) : []
  } catch { return [] }
}

function readFileRuns(): TestRun[] {
  try {
    ensureDir()
    // On Vercel, data/runs.json does not exist (git-ignored, local only).
    // Fall back to the committed real demo runs so the deployed dashboard
    // shows actual results, labelled as demo runs — never invented stats.
    const file = fs.existsSync(RUNS_FILE) ? RUNS_FILE : SAMPLE_FILE
    if (!fs.existsSync(file)) return []
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as TestRun[]
    return Array.isArray(raw) ? sortRuns(raw) : []
  } catch { return [] }
}

/**
 * Read runs from KV. Returns null when KV is unreachable (bad credentials
 * / network), so callers can fall back to the local file instead of
 * silently showing an empty history. An empty array means KV is reachable
 * but no runs have been stored yet.
 */
async function readKvRuns(): Promise<TestRun[] | null> {
  try {
    const { kv } = await import('@vercel/kv')
    const val = await kv.get<unknown>(KV_KEY)
    if (!val) return []
    if (typeof val === 'string') {
      const parsed = JSON.parse(val) as TestRun[]
      return Array.isArray(parsed) ? sortRuns(parsed) : []
    }
    return Array.isArray(val) ? sortRuns(val as TestRun[]) : []
  } catch {
    return null
  }
}

/** Strip any password field before storing — defence in depth. */
function cleanRun(run: TestRun): TestRun {
  const clean = JSON.parse(JSON.stringify(run)) as Record<string, unknown>
  delete clean.password
  return clean as unknown as TestRun
}

export async function listRuns(): Promise<TestRun[]> {
  if (storageBackend() === 'kv') {
    const runs = await readKvRuns()
    if (runs === null) return readFileRuns() // KV unreachable: file fallback
    // Empty KV (first use) shows the committed demo runs, exactly like
    // the file backend does — they are labelled demo runs in their names.
    return runs.length ? runs : readSampleRuns()
  }
  return readFileRuns()
}

export async function getRun(id: string): Promise<TestRun | null> {
  return (await listRuns()).find((r) => r.id === id) ?? null
}

export async function saveRun(run: TestRun): Promise<TestRun> {
  const clean = cleanRun(run)
  if (storageBackend() === 'kv') {
    try {
      const existing = await readKvRuns()
      if (existing !== null) {
        // First save seeds the store with the demo runs so the history the
        // dashboard already showed is preserved alongside real runs.
        const base = existing.length ? existing : readSampleRuns()
        const runs = [clean, ...base.filter((r) => r.id !== clean.id)].slice(0, MAX_RUNS)
        const { kv } = await import('@vercel/kv')
        await kv.set(KV_KEY, runs)
        return clean
      }
      console.error('Vercel KV unreachable, falling back to local file for this run.')
    } catch (e) {
      // KV unreachable (bad credentials / network): fall back to the
      // local file so a completed test run is not lost with a 500.
      console.error('Vercel KV write failed, falling back to local file:', e instanceof Error ? e.message : String(e))
    }
  }
  ensureDir()
  const runs = readFileRuns().filter((r) => r.id !== run.id)
  runs.unshift(clean)
  fs.writeFileSync(RUNS_FILE, JSON.stringify(runs.slice(0, MAX_RUNS), null, 2))
  return clean
}

export function dashboardStats(runs: TestRun[]) {
  return {
    total: runs.length,
    passed: runs.filter((r) => r.status === 'passed').length,
    failed: runs.filter((r) => r.status === 'failed' || r.status === 'error').length,
    findings: runs.reduce((n, r) => n + r.findings.length, 0),
    criticalHigh: runs.reduce((n, r) => n + r.findings.filter((f) => f.severity === 'Critical' || f.severity === 'High').length, 0),
  }
}
