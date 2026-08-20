// src/app/api/welcome-email/route.ts - API Route to dispatch Welcome & Role Access Email
import { NextRequest, NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/email/welcomeEmail';
import { AppRole } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = body.email || 'ccchurchbhilai2020@gmail.com';
    const fullName = body.fullName || 'CC Church Bhilai Administrator';
    const role: AppRole = (body.role as AppRole) || 'super_admin';

    const result = await sendWelcomeEmail({
      toEmail: email,
      fullName,
      role,
      loginUrl: body.loginUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://scoreboard-eight-xi.vercel.app/auth/login',
    });

    return NextResponse.json({
      success: true,
      message: `Welcome email dispatched to ${email}`,
      result,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email') || 'ccchurchbhilai2020@gmail.com';
  const fullName = searchParams.get('fullName') || 'CC Church Bhilai Administrator';
  const role = (searchParams.get('role') as AppRole) || 'super_admin';

  const result = await sendWelcomeEmail({
    toEmail: email,
    fullName,
    role,
    loginUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://scoreboard-eight-xi.vercel.app/auth/login',
  });

  return NextResponse.json({
    success: true,
    message: `Welcome email dispatched to ${email}`,
    result,
  });
}
