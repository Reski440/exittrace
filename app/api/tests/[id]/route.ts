import { NextResponse } from 'next/server'
import { getRun } from '../../../../lib/store'
export const dynamic = 'force-dynamic'
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const run = await getRun(params.id)
  if (!run) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(run)
}
