import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'aml-web',
      version: process.env.npm_package_version || 'unknown',
    },
    { status: 200 }
  );
}
