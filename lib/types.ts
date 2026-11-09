export type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational'
export type TestStatus = 'passed' | 'failed' | 'running' | 'error'

export interface TestConfig {
  name: string
  targetUrl: string
  loginUrl: string
  protectedUrl: string
  logoutUrl: string
  usernameSelector: string
  passwordSelector: string
  submitSelector: string
  username: string
  /** Session-only. Never persisted. The API route strips it before saving. */
  password?: string
  customLogoutSelector?: string
  allowLocalTargets?: boolean
  protectedMarker?: string
}

export interface TestStep {
  id: string
  label: string
  status: 'passed' | 'failed' | 'skipped' | 'info'
  detail: string
  durationMs: number
  evidence?: string
}

export interface Finding {
  id: string
  severity: Severity
  title: string
  detail: string
  evidence: string
  recommendation: string
}

export interface HttpDetail {
  url: string
  status: number
  cacheControl: string | null
  method: string
}

export interface TestRun {
  id: string
  name: string
  targetUrl: string
  protectedUrl: string
  createdAt: string
  durationMs: number
  status: TestStatus
  steps: TestStep[]
  findings: Finding[]
  httpDetails: HttpDetail[]
  consoleErrors: string[]
  screenshotPath?: string | null
  engine: 'local-playwright' | 'worker' | 'unavailable'
  notes?: string
}
