'use client';

// src/app/auth/signin/page.tsx - Redirector to unified /auth/login portal

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SignInRedirectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    }>
      <SignInRedirectContent />
    </Suspense>
  );
}

function SignInRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const next = searchParams.get('callbackUrl') || searchParams.get('next') || '';
    if (next) {
      router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
    } else {
      router.replace('/auth/login');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
        <p className="text-xs text-slate-400 font-mono">Redirecting to login portal...</p>
      </div>
    </div>
  );
}
