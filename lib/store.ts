import fs from 'node:fs'
import path from 'node:path'
import type { TestRun } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const RUNS_FILE = path.join(DATA_DIR, 'runs.json')

function ensureDir() { fs.mkdirSync(DATA_DIR, { recursive: true }) }

export function listRuns(): TestRun[] {
  try {
    ensureDir()
    // On Vercel, data/runs.json does not exist (git-ignored, local only).
    // Fall back to the committed real demo runs so the deployed dashboard
    // shows actual results, labelled as demo runs — never invented stats.
    const file = fs.existsSync(RUNS_FILE) ? RUNS_FILE : path.join(DATA_DIR, 'runs.sample.json')
    if (!fs.existsSync(file)) return []
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as TestRun[]
    return Array.isArray(raw) ? raw.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)) : []
  } catch { return [] }
}

export function getRun(id: string): TestRun | null {
  return listRuns().find((r) => r.id === id) ?? null
}

/** Store a run. Strips any password field before writing — defence in depth. */
export function saveRun(run: TestRun): TestRun {
  ensureDir()
  const clean = JSON.parse(JSON.stringify(run)) as Record<string, unknown>
  delete clean.password
  const runs = listRuns().filter((r) => r.id !== run.id)
  runs.unshift(clean as unknown as TestRun)
  fs.writeFileSync(RUNS_FILE, JSON.stringify(runs, null, 2))
  return clean as unknown as TestRun
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
