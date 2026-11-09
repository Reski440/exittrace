import { NextResponse } from 'next/server'
import { serverAllowsLocalTargets } from '../../../lib/ssrf'
import { storageInfo } from '../../../lib/store'

export const dynamic = 'force-dynamic'

/** Public, non-sensitive server configuration for the New Test form. */
export async function GET() {
  return NextResponse.json({
    allowLocalTargets: serverAllowsLocalTargets(),
    storage: storageInfo(),
    workerConfigured: Boolean(process.env.WORKER_URL),
  })
}
