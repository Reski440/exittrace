import type { Finding, HttpDetail, Severity } from './types'

let n = 0
function finding(severity: Severity, title: string, detail: string, evidence: string, recommendation: string): Finding {
  return { id: `F-${++n}`, severity, title, detail, evidence, recommendation }
}

/**
 * Evidence-gated analysis. Critical/High require a concrete observation:
 * a protected page returning 200 with its protected marker after logout.
 * Weak cache headers alone are Medium at most.
 */
export function analyze(opts: {
  protectedUrl: string
  httpDetails: HttpDetail[]
  afterLogoutStatus: number | null
  afterLogoutBodyHasMarker: boolean
  afterLogoutBodyHasLoginForm: boolean
  /** Result of a cache-busting fetch after logout: does the *server* still serve private data? */
  serverStillServesAfterLogout?: boolean
  serverCheckStatus?: number | null
  backNavUrl: string
  backNavBodyHasMarker: boolean
  backNavMadeNewProtectedRequest: boolean
  reloadAfterLogoutStatus: number | null
  reloadBodyHasMarker: boolean
  consoleErrors: string[]
}): Finding[] {
  n = 0
  const out: Finding[] = []
  const protectedResp = opts.httpDetails.find((h) => h.url === opts.protectedUrl)
  const cc = (protectedResp?.cacheControl ?? '').toLowerCase()

  if (opts.afterLogoutStatus === 200 && opts.afterLogoutBodyHasMarker) {
    if (opts.serverStillServesAfterLogout === true) {
      out.push(finding('Critical', 'Protected page still returns private content after logout',
        'A direct request to the protected page after logout returned HTTP 200 and the page body still contained the protected-page marker — and a cache-busting request confirmed the server itself still serves it.',
        `GET ${opts.protectedUrl} -> 200 after logout, marker present; no-store re-check also 200 with marker`,
        'Return 302 to the login page (or 401/403) for unauthenticated requests and send Cache-Control: no-store on every protected response.'))
    } else if (opts.serverStillServesAfterLogout === false) {
      out.push(finding('High', 'Protected page served from browser cache after logout',
        'Normal navigation to the protected page after logout still showed private content, but a cache-busting request was correctly blocked by the server. The exposure comes from the browser cache, not from the server re-serving private data — still a real exposure for anyone using the same browser.',
        `GET ${opts.protectedUrl} -> 200 after logout, marker present (cached); no-store re-check -> ${opts.serverCheckStatus ?? 'blocked'} without marker`,
        'Send Cache-Control: no-store, no-cache, must-revalidate, private on all authenticated responses so the browser never stores them.'))
    } else {
      out.push(finding('High', 'Protected page still returns private content after logout',
        'A direct request to the protected page after logout returned HTTP 200 and the page body still contained the protected-page marker.',
        `GET ${opts.protectedUrl} -> 200 after logout, marker present`,
        'Return 302 to the login page (or 401/403) for unauthenticated requests and send Cache-Control: no-store on every protected response.'))
    }
  } else if (opts.reloadAfterLogoutStatus === 200 && opts.reloadBodyHasMarker) {
    out.push(finding('High', 'Protected content reachable on reload after logout',
      'Reloading the protected page after logout returned HTTP 200 with the protected marker still present.',
      `Reload ${opts.protectedUrl} -> 200 after logout, marker present`,
      'Invalidate the session server-side on logout and require re-authentication for protected routes.'))
  }

  if (opts.backNavBodyHasMarker && !opts.backNavMadeNewProtectedRequest) {
    out.push(finding('Medium', 'Protected page visually restored from back-forward cache after logout',
      'Pressing Back after logout showed the protected page without a new network request for it — a BFCache restore. The page was visible, but no fresh protected data was fetched in this run.',
      `Back navigation landed on ${opts.backNavUrl} with the protected marker visible and no new protected-page request`,
      'Send Cache-Control: no-store and consider pageshow/persisted handling or a client-side auth check that redirects when the session is gone.'))
  } else if (opts.backNavBodyHasMarker && opts.backNavMadeNewProtectedRequest && opts.afterLogoutStatus !== 200) {
    out.push(finding('Low', 'Back navigation re-requested the protected page',
      'Back navigation triggered a fresh request for the protected page, which the server then handled (see the direct-access check for the verdict).',
      `Back navigation to ${opts.backNavUrl} made a new protected-page request`,
      'No action needed if the server blocks unauthenticated access; keep no-store headers so the restore cannot show stale content.'))
  }

  if (protectedResp) {
    if (!cc) {
      out.push(finding('Medium', 'Protected page has no Cache-Control header',
        'The protected response carried no Cache-Control header, so browsers and shared caches may store private content.',
        `GET ${opts.protectedUrl} -> ${protectedResp.status}, Cache-Control: (missing)`,
        'Send Cache-Control: no-store, no-cache, must-revalidate, private on all authenticated responses.'))
    } else if (!cc.includes('no-store')) {
      const sev: Severity = cc.includes('public') || /max-age=\d+/.test(cc) ? 'Medium' : 'Low'
      out.push(finding(sev, 'Protected page allows caching',
        `The protected response allows caching (Cache-Control: ${protectedResp.cacheControl}). Private pages should never be cacheable.`,
        `GET ${opts.protectedUrl} -> ${protectedResp.status}, Cache-Control: ${protectedResp.cacheControl}`,
        'Send Cache-Control: no-store, no-cache, must-revalidate, private on all authenticated responses.'))
    }
  }

  if (opts.consoleErrors.length > 0) {
    out.push(finding('Informational', 'Browser console errors during the test',
      `${opts.consoleErrors.length} console error(s) were captured while the test ran. They are not logout findings by themselves.`,
      opts.consoleErrors.slice(0, 3).join(' | '),
      'Review the console output in the test details and fix application errors that could mask auth behaviour.'))
  }

  if (out.length === 0) {
    out.push(finding('Informational', 'No logout exposure observed in this run',
      'The protected page was blocked after logout, Back/Forward did not expose private content, and cache headers were checked. This run found no evidence of post-logout exposure for the tested URLs.',
      'See the step-by-step results in this test run.',
      'Re-run after any auth, routing, or caching change.'))
  }
  return out
}
