// Deploys ExitTrace to the already-created Vercel project by inlining source
// files (no Git link — the Git-link flow is blocked by a team-scope 403).
// Usage: node scripts/deploy-vercel.mjs
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const PROJECT_ID = 'prj_TuXYnQdIbmeOScJEGXJK4pcpHVtK'
const ROOT = path.resolve(import.meta.dirname, '..')
const SKIP = new Set(['package-lock.json'])
const files = []
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue
    const p = path.join(dir, e.name)
    const rel = path.relative(ROOT, p)
    if (e.isDirectory()) { if (rel.startsWith('data/screenshots')) continue; walk(p); continue }
    if (SKIP.has(rel) || rel === 'data/runs.json' || rel.startsWith('scripts/deploy-vercel')) continue
    files.push({ file: rel, data: fs.readFileSync(p, 'utf8'), encoding: 'utf-8' })
  }
}
walk(ROOT)
console.log('files:', files.length, 'bytes:', files.reduce((n, f) => n + f.data.length, 0))
const args = JSON.stringify({ requestBody: { name: 'exittrace', project: PROJECT_ID, target: 'production', files } })
const out = execFileSync('/opt/hatch/bin/vercel', ['call-tool', '--name', 'create_deployment', '--arguments-json', args], { maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' })
console.log(out.slice(0, 4000))
