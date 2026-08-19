// src/app/api/time/route.ts - High Precision Server NTP Clock Sync Endpoint

import { NextResponse } from 'next/server';

export async function GET() {
  const serverTimestamp = Date.now();
  return NextResponse.json({
    serverTimeMs: serverTimestamp,
    iso: new Date(serverTimestamp).toISOString(),
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
