import { NextResponse } from 'next/server'
import { getRun } from '../../../../../lib/store'
import { reportHtml, reportJson } from '../../../../../lib/report'
export const dynamic = 'force-dynamic'
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const run = getRun(params.id)
  if (!run) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const format = new URL(req.url).searchParams.get('format') ?? 'json'
  if (format === 'html') {
    return new NextResponse(reportHtml(run), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="exittrace-${run.id}.html"` } })
  }
  return new NextResponse(reportJson(run), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="exittrace-${run.id}.json"` } })
}
