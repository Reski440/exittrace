import dns from 'node:dns/promises'
import net from 'node:net'

function isPrivateIp(ip: string): boolean {
  if (net.isIP(ip) === 0) return false
  if (ip === '127.0.0.1' || ip === '::1') return true
  const parts = ip.split('.').map(Number)
  if (parts.length === 4) {
    if (parts[0] === 10) return true
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
    if (parts[0] === 192 && parts[1] === 168) return true
    if (parts[0] === 169 && parts[1] === 254) return true
  }
  return ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')
}

/**
 * Server-side gate for localhost / private targets.
 *
 * The client-supplied `allowLocalTargets` flag is NEVER trusted on its own:
 * it only takes effect when the server operator has explicitly enabled it
 * with the ALLOW_LOCAL_TARGETS environment variable (dashboard / local
 * engine) or WORKER_ALLOW_LOCAL_TARGETS (standalone worker). Both default
 * to off, so a public deployment blocks localhost/private targets even if
 * a caller sends `allowLocalTargets: true`.
 */
export function serverAllowsLocalTargets(): boolean {
  const v = process.env.ALLOW_LOCAL_TARGETS ?? process.env.WORKER_ALLOW_LOCAL_TARGETS ?? ''
  return v === 'true' || v === '1'
}

/** Effective local-target permission: client request AND server opt-in. */
export function effectiveAllowLocalTargets(clientRequested: boolean): boolean {
  return clientRequested && serverAllowsLocalTargets()
}

/** Validate a target URL. Blocks non-http(s), credentials in URL, and
 *  private/loopback hosts unless local testing is explicitly enabled
 *  on the server (see serverAllowsLocalTargets). */
export async function validateTargetUrl(raw: string, allowLocal: boolean): Promise<{ ok: true; url: URL } | { ok: false; error: string }> {
  let url: URL
  try { url = new URL(raw) } catch { return { ok: false, error: `Invalid URL: ${raw}` } }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, error: 'Only http:// and https:// targets are allowed' }
  if (url.username || url.password) return { ok: false, error: 'URLs must not contain embedded credentials' }
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host === '0.0.0.0') {
    if (!allowLocal) return { ok: false, error: 'Localhost targets are blocked on this server. The server operator must set ALLOW_LOCAL_TARGETS=true to enable local testing mode.' }
    return { ok: true, url }
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host) && !allowLocal) return { ok: false, error: 'Private IP targets are blocked on this server. The server operator must set ALLOW_LOCAL_TARGETS=true to enable local testing mode.' }
    return { ok: true, url }
  }
  // Resolve and check for DNS rebinding to private addresses.
  try {
    const addrs = await dns.lookup(host, { all: true })
    if (addrs.some((a) => isPrivateIp(a.address)) && !allowLocal) {
      return { ok: false, error: 'Target resolves to a private address; blocked on this server unless local testing mode is enabled by the server operator.' }
    }
  } catch {
    return { ok: false, error: `Could not resolve host: ${host}` }
  }
  return { ok: true, url }
}
