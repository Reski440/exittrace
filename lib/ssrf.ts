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

/** Validate a target URL. Blocks non-http(s), credentials in URL, and
 *  private/loopback hosts unless local testing is explicitly enabled. */
export async function validateTargetUrl(raw: string, allowLocal: boolean): Promise<{ ok: true; url: URL } | { ok: false; error: string }> {
  let url: URL
  try { url = new URL(raw) } catch { return { ok: false, error: `Invalid URL: ${raw}` } }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, error: 'Only http:// and https:// targets are allowed' }
  if (url.username || url.password) return { ok: false, error: 'URLs must not contain embedded credentials' }
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host === '0.0.0.0') {
    if (!allowLocal) return { ok: false, error: 'Localhost targets require local testing mode (allowLocalTargets)' }
    return { ok: true, url }
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host) && !allowLocal) return { ok: false, error: 'Private IP targets are blocked unless local testing mode is enabled' }
    return { ok: true, url }
  }
  // Resolve and check for DNS rebinding to private addresses.
  try {
    const addrs = await dns.lookup(host, { all: true })
    if (addrs.some((a) => isPrivateIp(a.address)) && !allowLocal) {
      return { ok: false, error: 'Target resolves to a private address; blocked unless local testing mode is enabled' }
    }
  } catch {
    return { ok: false, error: `Could not resolve host: ${host}` }
  }
  return { ok: true, url }
}
