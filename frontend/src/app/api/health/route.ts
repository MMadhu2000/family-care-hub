import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'family-care-hub-frontend',
    timestamp: new Date().toISOString(),
    database: 'not_checked',
  });
}
